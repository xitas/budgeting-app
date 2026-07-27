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

## Recurring transaction generation

Generation is lazy + cron-backed:
- A daily `node-cron` job calls `generateDueTransactions()` for every active
  `RecurringTransaction`.
- The same function also runs on-demand whenever a user requests their
  transactions or dashboard data, so results are never stale even if the
  server wasn't running when a transaction was due — useful in local dev.
- Generation is idempotent: it only creates transactions between
  `lastGeneratedDate` and "now", then advances the cursor.
