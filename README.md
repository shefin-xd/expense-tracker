# CampusLedger

Minimal, private expense tracker for college students (MERN + TypeScript).
`server/` is the API (Express, MongoDB, integer-paise ledger). `client/` is the React app (Vite, Tailwind, TanStack Query).
Still to come: deployment guide (Vercel + Render/Railway + Atlas, DNS for expenses.shefin.dev).

## Run it locally
```
# 1. API
cd server
cp .env.example .env      # set MONGODB_URI (an Atlas cluster, or a local replica set) and a 32+ char JWT_SECRET
npm install
npm test                  # first run downloads a MongoDB binary for the DB tests
npm run dev               # http://localhost:4000
npm run seed:owner        # optional: creates the owner account from OWNER_EMAIL / OWNER_PASSWORD in .env

# 2. App (new terminal)
cd client
npm install
npm run dev               # http://localhost:5173 (Vite proxies /api to the API, so cookies just work)
npm test                  # unit + screen tests
npm run build             # type-check and production build into dist/
```
Production: set `VITE_API_URL` (client) to the public API URL, and `CLIENT_URL` + `COOKIE_DOMAIN` (server) so the cookie works across the two subdomains.

## How money works
Every money movement is one row in `LedgerEntry` (integer paise). Balance, dashboard and history are all computed from it.
Income +, expense -, fee payment - (unpaid fees never post), lend -, lend repayment +, borrow + (a liability, not income),
borrow repayment -. Savings goals are tracked separately and never move the balance.

## Client
Pages: Dashboard, Transactions, Expenses, Income, Fees & Payments, Borrow & Lend, Budgets, Savings, Reports & Exports, Settings.
Light, dark and system themes; sidebar on desktop, bottom bar on phones; the Add button opens a quick-add sheet from anywhere.
Dates and month boundaries are Asia/Kolkata. The date format preference (DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD) applies everywhere.
`client/e2e/browser-walkthrough.py` drives a real Firefox through register, every money flow, downloads, themes, mobile layout and sign-out.

## API (all under /api, cookie auth, amounts in rupees in, `amountPaise` out)
| Area | Endpoints |
|---|---|
| Auth | POST auth/register, auth/login, auth/logout; GET auth/me |
| Users | PATCH users/me; POST users/me/password; GET users/me/export; DELETE users/me |
| Dashboard | GET dashboard?from&to |
| Transactions | GET transactions?type&kind&category&search&from&to&sortBy&order&page&limit; GET transactions/summary |
| Expenses | CRUD expenses (+ search/category/paymentMethod/date/sort/pagination) |
| Categories | GET/POST categories; PATCH/DELETE categories/:id |
| Income | CRUD income; GET income/parent-summary |
| Fees | CRUD fees; POST fees/:id/payments; POST fees/:id/complete; DELETE fees/:id/payments/:pid |
| Lending / Borrowing | CRUD lending, borrowing; POST :id/repayments; DELETE :id/repayments/:rid; GET summary |
| Budgets | GET/PUT budgets/:month (YYYY-MM or "current"); GET budgets/:month/compare |
| Savings | GET/POST savings; PATCH/DELETE savings/:id |
| Notifications | GET notifications; POST notifications/read-all, :id/read; DELETE :id |
| Reports | GET reports/pdf, reports/xlsx, reports/csv |
| Health | GET health |

### Reports and exports
`GET /api/reports/{pdf|xlsx|csv}`: `type` = monthly (default), yearly, custom, expenses, income, fees; `month=2026-11`, `year=2026`,
`from=2026-11-01&to=2026-11-30` (whole IST days, max 5 years), `academicYear=2026-27` (fees), `dataset=transactions|expenses|income|fees|loans` (CSV).
PDF amounts print as "Rs." (standard PDF fonts have no rupee glyph); spreadsheets use ₹. CSV text cells starting with = + - @ are prefixed with ' to block formula injection.
