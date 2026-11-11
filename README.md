# CampusLedger

Minimal multi-user expense tracker for college students (MERN + TypeScript).
The API (auth, ledger, CRUD modules, reports/exports) lives in `server/`; the React app lives in `client/`. Phase 5 (deployment docs) is still to come.

## Run the server
```
cd server
cp .env.example .env      # set MONGODB_URI (Atlas) and a 32+ char JWT_SECRET
npm install
npm test                  # first run downloads a MongoDB binary for the DB tests
npm run dev
npm run seed:owner        # optional: creates the owner account from OWNER_EMAIL / OWNER_PASSWORD
```

## How money works
Every money movement is one row in `LedgerEntry` (integer paise). Balance, dashboard and history are all
computed from it. Rules: income +, expense -, fee payment - (unpaid fees never post), lend -, lend repayment +,
borrow + (liability, not income), borrow repayment -. Savings goals are tracked separately and never move the balance.

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
| Reports | GET reports/summary, reports/pdf, reports/xlsx, reports/csv (see below) |
| Health | GET health |

## Reports and exports
All four endpoints take the same query and only ever read the logged-in user's data.

| Query | Meaning |
|---|---|
| `month=2026-10` | Monthly report (IST month). Default: the current month |
| `year=2026` | Yearly report |
| `from=2026-10-01&to=2026-10-15` | Custom range, inclusive of the whole last day (IST). Max 5 years |
| `scope=all\|expenses\|income\|fees` | Full report, or expense-only, income-only, fee report |
| `section=...` (csv only) | `transactions` (default), `summary`, `income`, `expenses`, `fees`, `fee_payments`, `lent`, `borrowed`, `budgets`, `savings`, `categories` |

- **PDF**: opening balance, income, expenses, remaining balance, category breakdown, transaction history, upcoming
  payments and savings summary. The Inter font is embedded from `server/assets/fonts` (the built-in PDF fonts have no
  ₹ sign), so deploy that folder with the server. Very long histories are capped at 2,000 rows in the PDF.
- **XLSX**: sheets Dashboard Summary, Income, Expenses, Fees and Payments, Borrowed Money, Lent Money, Budgets and
  Savings (narrower scopes produce fewer sheets). Real numeric and date cells, ₹ number format, header filters and
  SUBTOTAL totals that follow the filter.
- **CSV**: UTF-8 with BOM, amounts as plain rupees (`1250.50`), ISO dates. Text that starts with `= + - @` is
  prefixed with `'` so spreadsheet apps cannot run it as a formula.
- Opening balance is everything before the range, remaining balance is everything up to its end, and both come from
  the ledger, so they always match the dashboard. Each successful download adds an in-app "Export ready" notification.

## Tests
`npm test` runs against a real MongoDB replica set (`mongodb-memory-server`). If it cannot download MongoDB, point it
at an installed binary: `MONGOMS_SYSTEM_BINARY=/path/to/mongod MONGOMS_VERSION=<its version> npm test`.

## Run the client
```
cd client
npm install
npm run dev          # http://localhost:5173 — /api is proxied to http://localhost:4000, so cookies just work
npm test             # utilities + jsdom smoke tests for every page
npm run build        # type-checks, then builds to client/dist
```
Production: set `VITE_API_URL` (e.g. `https://api.shefin.dev/api`) at build time. `vercel.json` provides the SPA fallback.
The server must have `CLIENT_URL` set to the exact frontend origin (CORS with credentials).

### Client structure
`src/lib` (API client, money, IST dates) · `src/components/ui` (design-system parts) · `src/layouts` · `src/features/<area>` (api hooks, forms, page) · `src/store` (theme, quick-add, toasts).
Amounts are typed as text and sent to the API as exact rupee strings; they are never parsed to floats. Every date is an Asia/Kolkata calendar day.
