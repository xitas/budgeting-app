# Architecture

## Overview

```
┌─────────────┐        HTTPS/JSON         ┌──────────────┐        Mongoose        ┌───────────┐
│   React SPA │  ────────────────────────▶│ Express API  │ ─────────────────────▶ │  MongoDB  │
│  (client/)  │◀──── httpOnly cookies ────│  (server/)   │◀──── aggregations ─────│           │
└─────────────┘                            └──────────────┘                        └───────────┘
```

## Auth flow (JWT access + refresh)

1. **Signup/Login** — server hashes password with bcrypt, issues a short-lived
   **access token** (returned in the JSON body, kept in memory on the client —
   never localStorage) and a long-lived **refresh token** set as an
   `httpOnly`, `secure`, `sameSite=lax` cookie (never touched by client JS).
2. **Authenticated requests** — client sends the access token; `middleware/auth.ts`
   verifies it and attaches `req.user`.
3. **Refresh** — when the access token expires, the client's axios interceptor
   calls `POST /api/auth/refresh` once; the server validates the refresh
   cookie against `User.refreshTokenVersion` and rotates both tokens.
4. **Logout** — clears the refresh cookie; bumping `refreshTokenVersion`
   invalidates all outstanding refresh tokens at once (e.g. "log out
   everywhere").

## Data model decisions

- **Reference, don't embed, for `Transaction`**: transactions reference
  `User` and `Category` by ObjectId rather than embedding, because the
  collection is unbounded and grows independently of its parents — embedding
  would risk the 16MB MongoDB document size limit and duplicate category data
  across every transaction.
- **`RecurringTransaction` as a template**: a small, stable document that
  generates `Transaction` instances over time (tracked via a
  `lastGeneratedDate` cursor), rather than storing all future occurrences
  up front.
- **No denormalized "spent" field on `Budget`**: budget-vs-actual is always
  computed at read time via an aggregation pipeline over `Transaction`, so it
  is never stale relative to the source data.
- **Embed, don't reference, for `Loan.repayments`**: the deliberate contrast
  to `Transaction` above. A loan's repayments are bounded (a handful over the
  life of one loan), always read together with the loan, and never queried
  independently across users — the textbook embed case. `repaid`/`outstanding`
  are schema virtuals computed by reducing over the already-loaded
  `repayments` array — no aggregation needed, since embedding means the data
  is already in memory once the parent document loads.

## Loans and multi-document transactions

Every loan event (creating a loan, adding or removing a repayment, deleting a
loan) writes to **two** documents that must succeed or fail together: the
`Loan` itself and a linked `Transaction` (so lending/borrowing/repaying
affects real income/expense/net, not a side ledger). These writes run inside
a real MongoDB multi-document transaction (`mongoose.startSession()` /
`session.withTransaction()`), which is why local MongoDB now runs as a
**single-node replica set** (`docker-compose.yml`) instead of a plain
standalone `mongod` — standalone instances can't run `withTransaction()` at
all. `npm run mongo:up` waits (`--wait`) for the replica set to actually be
ready before returning, closing a startup race that would otherwise make the
first `withTransaction()` call fail.

Cash-flow direction is computed once, consistently, from two inputs — the
loan's `direction` and whether the event is the initial loan or a repayment:
lending out and repaying a borrowed loan are both a `Loan Out` expense;
borrowing and being repaid are both a `Loan In` income. Writing off a loan
(irrecoverable debt, or a forgiven debt from the other side) is a plain
boolean flag, not a new transaction — the original lend/borrow transaction
already recorded the real cash movement.

Because `Loan.outstanding` is a derived invariant tied to its linked
transaction's amount, editing or deleting that transaction directly (from
the Transactions table) is blocked (`409`) — it has to go through the Loans
tab, which keeps both sides in sync.

Dashboard aggregations treat loan cash flow differently depending on what
they're for: `getSummary`'s **income**/**expense** tiles and the
spending/trend charts exclude it (they're spending/earning *behavior*
figures), while a dedicated **net lending** figure and the overall **net**
include it — Income − Expense + Net lending = Net, so the arithmetic
visibly closes on the dashboard.

## Recurring transaction generation

Generation is lazy + cron-backed:
- A daily `node-cron` job calls `generateDueTransactions()` for every active
  `RecurringTransaction`.
- The same function also runs on-demand whenever a user requests their
  transactions or dashboard data, so results are never stale even if the
  server wasn't running when a transaction was due — useful in local dev.
- Generation is idempotent: it only creates transactions between
  `lastGeneratedDate` and "now", then advances the cursor.

## Dashboard aggregations

All four `/api/dashboard/*` endpoints are read-only aggregation pipelines over
`Transaction` (plus one that reuses the existing budget service) — nothing is
precomputed or denormalized:

- **Summary** (`/summary`): a single `$facet` computes four totals in one
  round trip — non-loan income, non-loan expense, loan income, and loan
  expense — from which `netLending` and the overall `net` are derived (see
  "Loans and multi-document transactions" above for why loan cash flow is
  split out).
- **Spending by category** (`/spending-by-category`): `$match` + `$group` +
  `$lookup` joins each category's name/color in the same pipeline, excluding
  loan-sourced transactions; anything past the top 7 categories folds into an
  "Other" bucket, since the categorical color palette caps at 8 usable
  identity slots.
- **Income vs expense trend** (`/income-vs-expense`): `$group` by
  `{ $year, $month, type }` over a trailing window (also excluding
  loan-sourced transactions), then zero-filled in JS so a quiet month renders
  as 0 rather than a gap. Date range boundaries are built with `Date.UTC(...)`
  rather than the local-time `Date` constructor, so they agree with
  `$year`/`$month`'s UTC-based extraction regardless of the server's local
  timezone.
- **Budget vs actual** (`/budget-vs-actual`): reuses `budget.service.ts`'s
  existing spent/remaining calculation rather than duplicating it.
