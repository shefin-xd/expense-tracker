# CampusLedger

Minimal multi-user expense tracker for college students (MERN + TypeScript).
Phase 1 (foundation) and Phase 2 (API modules) live in `server/`. Phases 3-5: reports/exports, React client, deployment docs.

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
| Health | GET health |
