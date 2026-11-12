# Deploying CampusLedger to expenses.shefin.dev

```
Browser ──► https://expenses.shefin.dev   (React app, Vercel)
   │
   └──────► https://api.shefin.dev        (Express API, Render)  ──►  MongoDB Atlas
```

Both hostnames share the registrable domain `shefin.dev`, so the sign-in cookie (`Domain=.shefin.dev`, `HttpOnly`, `Secure`, `SameSite=Lax`) is sent to the API without any third-party-cookie problems.

You need free accounts at GitHub, MongoDB Atlas, Render and Vercel, access to the DNS settings for `shefin.dev`, and an email (SMTP) provider for password-reset emails.

## 1. Put the code on GitHub
Push the whole folder (it has `client/` and `server/`) to one private repository. `.env` files are git-ignored. Never commit secrets.

## 2. MongoDB Atlas (database)
1. Create a project and a cluster (the free **M0** tier is enough to start). Pick a region near you, such as Mumbai (`ap-south-1`).
2. **Database Access** → add a user with a long random password. Give it read/write on any database.
3. **Network Access** → allow Render to connect. Free Render services do not have fixed outbound IPs, so the simple option is `0.0.0.0/0` (anyone on the internet can *try* to connect, but still needs the password). With a paid plan you can restrict to Render's outbound IPs instead.
4. **Connect → Drivers** → copy the connection string and add the database name before the `?`:
   `mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/campusledger?retryWrites=true&w=majority`
   (URL-encode special characters in the password.) Atlas clusters are replica sets, which CampusLedger needs for its all-or-nothing money writes.

## 3. API on Render
1. Render Dashboard → **New → Blueprint** → choose your repository. Render reads `render.yaml`.
2. When asked, fill in the values that are not stored in the file:
   - `MONGODB_URI`: the string from step 2.
   - `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`: from your email provider (see section 6).
   `JWT_SECRET` is generated for you. `CLIENT_URL` (`https://expenses.shefin.dev`) and `COOKIE_DOMAIN` (`.shefin.dev`, with the leading dot) are already set.
3. Wait for the first deploy, then open `https://<your-service>.onrender.com/api/health`. You should see `{"success":true,"data":{"status":"ok",...}}`.
4. Service → **Settings → Custom Domains → Add** `api.shefin.dev`. Render shows the DNS target (your `<service>.onrender.com` address). Add the DNS record in section 5, then press **Verify**. Render issues the HTTPS certificate automatically.

Free web services on Render go to sleep when idle, so the first request after a quiet period can take a while. Check Render's current plan details; a paid instance removes the delay.

## 4. App on Vercel
1. Vercel → **Add New → Project** → import the same repository.
2. **Root Directory:** `client`. Framework preset: Vite (detected automatically).
3. **Environment Variables:** `VITE_API_URL` = `https://api.shefin.dev` (no trailing slash). Set it before the first build; Vite bakes it in.
4. Deploy. Then **Settings → Domains → Add** `expenses.shefin.dev`. Vercel shows the CNAME value to use. Copy it exactly: it is specific to your project.

`client/vercel.json` already contains the single-page-app rewrite and the security headers, including a Content-Security-Policy that allows the app to talk only to itself and `https://api.shefin.dev`. If you ever use a different API hostname, change `connect-src` there.

## 5. DNS records for shefin.dev
Add these at whoever hosts the DNS for `shefin.dev` (your registrar, or Cloudflare):

| Type | Name (host) | Value | Purpose |
|---|---|---|---|
| CNAME | `expenses` | the value Vercel shows for this domain (looks like `xxxxxxxx.vercel-dns-017.com`; the general fallback is `cname.vercel-dns.com`) | the app |
| CNAME | `api` | your Render address, e.g. `campusledger-api.onrender.com` | the API |

Notes:
- Enter only the subdomain (`expenses`, `api`) in the Name field, not the full hostname.
- A name can have only one record. Delete any existing A, AAAA or CNAME record for `expenses` or `api` first.
- On Cloudflare, set both records to **DNS only** (grey cloud) so Vercel and Render can issue certificates.
- Changes usually appear within minutes but can take longer. Check with `dig +short CNAME expenses.shefin.dev` and `dig +short CNAME api.shefin.dev`. Vercel and Render show a green "valid" or "verified" status when they see the record.

## 6. Email for password resets
Any SMTP service works (Brevo, Resend, Mailgun, a Gmail app password, and so on). Create a sender or domain there, then set on Render: `SMTP_HOST`, `SMTP_PORT` (587 normally, 465 for implicit TLS), `SMTP_USER`, `SMTP_PASS`, and `EMAIL_FROM` (an address your provider has verified, such as `CampusLedger <no-reply@shefin.dev>`). Add the SPF/DKIM records your provider gives you so messages do not land in spam.

If `SMTP_HOST` is empty in production the server logs a warning and sends nothing. For privacy, "forgot password" still answers the same way either way, so test it once after deploying.

## 7. Create your account
Either register in the app, or create the owner profile from your own computer without writing the password anywhere permanent:
```
cd server
MONGODB_URI="<atlas string>" OWNER_EMAIL="you@example.com" OWNER_PASSWORD="<long password>" npm run seed:owner
```
The script creates Shefin Franklin's profile (CET, Computer Science and Engineering, First Year, CET Men's Hostel) with the email and password you pass in.

## 8. After deploying, check
- `https://api.shefin.dev/api/health` returns `status: ok`.
- Register, add an income and an expense, reload the page: you stay signed in and the balance is right.
- In the browser dev tools (Application → Cookies) the `cl_token` cookie is `HttpOnly`, `Secure`, domain `.shefin.dev`.
- Download a PDF, an Excel file and a CSV from Reports & Exports.
- "Forgot password" delivers an email and the link works once.
- Sign in from your phone.

## Running costs and backups
The free tiers of Atlas, Render and Vercel are enough to start, but check each provider's current limits. Atlas M0 does not include scheduled backups: run `mongodump` now and then, or let each student download their data from **Settings → Download my data**.

## Troubleshooting
| Symptom | Likely cause |
|---|---|
| Sign-in works, then every page says you are signed out | `COOKIE_DOMAIN` is not `.shefin.dev`, or the app or API is on a different registrable domain, or you are on plain http |
| Browser console shows a CORS error | `CLIENT_URL` on Render does not match the site's address (it must be exactly `https://expenses.shefin.dev`) |
| Console shows "violates Content Security Policy" | The API hostname is not the one in `client/vercel.json` `connect-src` |
| Refreshing `/expenses` shows a 404 | `client/vercel.json` was not deployed, or the Vercel root directory is not `client` |
| API fails to start with "Invalid production configuration" | `CLIENT_URL` is not https, `JWT_SECRET` is a placeholder, or `COOKIE_DOMAIN` has no leading dot |
| "Transaction numbers are only allowed on a replica set" | The database is not an Atlas cluster or a replica set |
| Reset email never arrives | SMTP variables missing or the sender is not verified; check the Render logs |
| First request is slow | The free Render service was asleep |

Rotating `JWT_SECRET` signs everyone out, which is the right response if you ever suspect it leaked.
