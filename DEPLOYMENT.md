# Deploying CampusLedger (expenses.shefin.dev, auth.shefin.dev, api.shefin.dev)

```
Browser ──► https://auth.shefin.dev       sign in, register, forgot / reset password   (React app, Vercel project 2, folder auth/)
   │            │ after sign-in: back to the page you asked for
   ├──► https://expenses.shefin.dev      the expense tracker                           (React app, Vercel project 1, folder client/)
   │
   └──► https://api.shefin.dev           one API for both apps                         (Express, Render, folder server/)  ──►  MongoDB Atlas
```

**How sign-in works.** Signing in happens only on `auth.shefin.dev`. The API sets one session cookie for the whole domain (`Domain=.shefin.dev`, `HttpOnly`, `Secure`, `SameSite=Lax`), so every `*.shefin.dev` app is signed in at once (single sign-on). When someone opens `expenses.shefin.dev` without a session, the app sends them to `auth.shefin.dev/login?redirect=<where they were going>`; after signing in they are sent back. The sign-in app only returns people to origins you list (it ignores any other `redirect`), so it cannot be used for phishing redirects. Signing out in the app ends the session everywhere and returns to the sign-in app.

You need free accounts at GitHub, MongoDB Atlas, Render and Vercel, access to the DNS settings for `shefin.dev`, and a Mailtrap account for password-reset emails.

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
   - `MAILTRAP_API_TOKEN`: from Mailtrap (see section 6).
   `JWT_SECRET` is generated for you. `CLIENT_URL` (`https://expenses.shefin.dev`), `AUTH_URL` (`https://auth.shefin.dev`) and `COOKIE_DOMAIN` (`.shefin.dev`, with the leading dot) are already set. The API accepts browser requests only from those two origins.
3. Wait for the first deploy, then open `https://<your-service>.onrender.com/api/health`. You should see `{"success":true,"data":{"status":"ok",...}}`.
4. Service → **Settings → Custom Domains → Add** `api.shefin.dev`. Render shows the DNS target (your `<service>.onrender.com` address). Add the DNS record in section 5, then press **Verify**. Render issues the HTTPS certificate automatically.

Free web services on Render go to sleep when idle, so the first request after a quiet period can take a while. Check Render's current plan details; a paid instance removes the delay.

## 4. The two apps on Vercel
Create **two** Vercel projects from the same repository (Add New → Project → import it twice).

**Project 1: the expenses app**
1. Root Directory `client`. Framework preset: Vite (detected).
2. Environment variables (set them before the first build; Vite bakes them in):
   - `VITE_API_URL` = `https://api.shefin.dev`
   - `VITE_AUTH_URL` = `https://auth.shefin.dev`
3. Deploy, then Settings → Domains → add `expenses.shefin.dev`. Vercel shows the CNAME value to use; copy it exactly, it is specific to your project.

**Project 2: the sign-in app**
1. Root Directory `auth`. Framework preset: Vite.
2. Environment variables:
   - `VITE_API_URL` = `https://api.shefin.dev`
   - `VITE_APP_URL` = `https://expenses.shefin.dev` (where people land by default, and the first trusted redirect)
   - `VITE_ALLOWED_REDIRECTS` = optional, comma-separated extra origins for other apps on your domain, for example `https://notes.shefin.dev`
3. Deploy, then Settings → Domains → add `auth.shefin.dev` and copy the CNAME value Vercel shows.

Each app's `vercel.json` already contains the single-page-app rewrite and security headers, including a Content-Security-Policy that lets the app talk only to itself and `https://api.shefin.dev`. If you ever use a different API hostname, change `connect-src` in both files.

## 5. DNS records for shefin.dev
Add these at whoever hosts the DNS for `shefin.dev` (your registrar, or Cloudflare). Each Vercel project has its own value, so `expenses` and `auth` point at different targets:

| Type | Name (host) | Value | Purpose |
|---|---|---|---|
| CNAME | `expenses` | the value Vercel shows for this domain (looks like `xxxxxxxx.vercel-dns-017.com`; the general fallback is `cname.vercel-dns.com`) | the app |
| CNAME | `auth` | the value Vercel shows for the sign-in project's domain | sign-in |
| CNAME | `api` | your Render address, e.g. `campusledger-api.onrender.com` | the API |

Notes:
- Enter only the subdomain (`expenses`, `api`) in the Name field, not the full hostname.
- A name can have only one record. Delete any existing A, AAAA or CNAME record for `expenses`, `auth` or `api` first.
- On Cloudflare, set both records to **DNS only** (grey cloud) so Vercel and Render can issue certificates.
- Changes usually appear within minutes but can take longer. Check with `dig +short CNAME expenses.shefin.dev`, `dig +short CNAME auth.shefin.dev` and `dig +short CNAME api.shefin.dev`. Vercel and Render show a green "valid" or "verified" status when they see the record.

## 6. Email for password resets (Mailtrap)
CampusLedger sends email through Mailtrap's HTTP API, not SMTP. This matters on Render: free web services block outbound SMTP ports (25, 465, 587), so an SMTP setup would silently fail there, while an HTTPS call works.

**Live sending (real students receive the email)**
1. In Mailtrap, open **Sending Domains**, add `shefin.dev`, and add the DNS records Mailtrap shows (SPF, DKIM and so on) at your DNS provider. Wait until the domain shows as verified.
2. Create an **API token** with sending permission for that domain (Settings → API Tokens).
3. On Render set `MAILTRAP_API_TOKEN` to that token and `EMAIL_FROM` to an address on the verified domain, for example `CampusLedger <no-reply@shefin.dev>`. Leave `MAILTRAP_INBOX_ID` unset.

**Testing only (nothing is delivered)**
Set `MAILTRAP_INBOX_ID` to your Mailtrap testing inbox's number as well. Reset emails then land in that inbox, where you can open and inspect them, and are never delivered to real people. Remove the variable before you invite friends.

The server prints one line at startup telling you which mode is active (`Mailtrap live sending`, `Mailtrap TESTING inbox`, or `NOT configured`); look for it in the Render logs. If no token is set in production, no email is sent. The "forgot password" screen still answers the same way for privacy, so test it once after deploying.

## 7. Create your account
Either register in the app, or create the owner profile from your own computer without writing the password anywhere permanent:
```
cd server
MONGODB_URI="<atlas string>" OWNER_EMAIL="you@example.com" OWNER_PASSWORD="<long password>" npm run seed:owner
```
The script creates Shefin Franklin's profile (CET, Computer Science and Engineering, First Year, CET Men's Hostel) with the email and password you pass in.

## 8. After deploying, check
- `https://api.shefin.dev/api/health` returns `status: ok`.
- Open `https://expenses.shefin.dev` signed out: you land on `auth.shefin.dev`, sign in, and come back to the expenses app.
- Register, add an income and an expense, reload the page: you stay signed in and the balance is right.
- Sign out: you return to `auth.shefin.dev` with a "You are signed out" notice.
- Open `auth.shefin.dev/login?redirect=https://example.com` and sign in: you still end up in the expenses app, never on example.com.
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
| Browser console shows a CORS error | `CLIENT_URL` or `AUTH_URL` on Render does not match the site's address (exactly `https://expenses.shefin.dev` and `https://auth.shefin.dev`) |
| Signing in bounces you straight back to the sign-in page | The cookie is not shared: `COOKIE_DOMAIN` must be `.shefin.dev`, both apps and the API must be on https, and the API must be on `*.shefin.dev` |
| After signing in you land on the wrong app | `VITE_APP_URL` in the sign-in project is wrong, or the requested origin is not in `VITE_ALLOWED_REDIRECTS` (rebuild after changing either) |
| The expenses app sends you to `localhost:5174` | `VITE_AUTH_URL` was not set in the expenses Vercel project before the build; set it and redeploy |
| Console shows "violates Content Security Policy" | The API hostname is not the one in `client/vercel.json` `connect-src` |
| Refreshing a page shows a 404 | The app's `vercel.json` was not deployed, or the Vercel root directory is not `client` (expenses) or `auth` (sign-in) |
| API fails to start with "Invalid production configuration" | `CLIENT_URL` is not https, `JWT_SECRET` is a placeholder, or `COOKIE_DOMAIN` has no leading dot |
| "Transaction numbers are only allowed on a replica set" | The database is not an Atlas cluster or a replica set |
| Reset link opens the wrong site | `AUTH_URL` on Render is missing or wrong (reset links point at it) |
| Reset email never arrives | `MAILTRAP_API_TOKEN` missing, `MAILTRAP_INBOX_ID` still set (testing mode), or `EMAIL_FROM` is not on a verified Mailtrap domain; the Render logs show the Mailtrap error |
| Build fails with TypeScript errors in files that are not part of this project (`report.*.ts`, `feedback.tsx`, `features/*/…Page.tsx`) | Leftover files from another version are still in the repository; see the last section |
| First request is slow | The free Render service was asleep |

Rotating `JWT_SECRET` signs everyone out, which is the right response if you ever suspect it leaked.

## If a build fails with TypeScript errors in files you do not recognise
Errors such as `report.pdf.ts`, `report.tables.ts`, `ReportData`, `istDateAsUtc` (API) or `components/ui/feedback.tsx`, `useToasts`, `ConfirmDialog` exported from `ui/Modal`, `features/expenses/ExpensesPage.tsx` (app) come from leftover files of a different version that were committed next to this one. In this project the pages are in `client/src/pages/`, the report exporters are in `server/src/exports/`, and the confirm dialog is `client/src/components/ui/Confirm.tsx`.

Find them with the script in this project (run from your repository root; works on Windows, macOS and Linux):
```
node scripts/find-stale-files.mjs
```
It lists every committed file under `client/src`, `auth/src` and `server/src` that is not part of this project, and prints the `git rm ...` command to remove them; it also lists any of this project's files that are missing from your repository. Remove the stale files, commit and push. If the list is long, the simplest fix is to delete your `client/` and `server/` folders and extract the ones from the zip.

Both builds now type-check only the files that are actually imported (`server/tsconfig.build.json`, `client/tsconfig.build.json`), so a stray unused file can no longer fail a deploy by itself. It still cannot help if a stale file is imported by the code that runs, which is why cleaning them out matters. `npm run typecheck` in each folder checks every file, including tests.
