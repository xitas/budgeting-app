# Budget App

[![CI](https://github.com/xitas/budgeting-app/actions/workflows/ci.yml/badge.svg)](https://github.com/xitas/budgeting-app/actions/workflows/ci.yml)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Node.js](https://img.shields.io/badge/Node.js-Express-339933?logo=node.js&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-47A248?logo=mongodb&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

A personal budget management web app — track income and expenses, set monthly
budgets per category, automate recurring transactions, and visualize spending
with charts.

Built as a learning project for MongoDB/Mongoose (schema design, indexes,
aggregation pipelines) and as a portfolio piece.

<p align="center">
  <img src="docs/screenshots/web/desktop-light-dashboard.png" alt="Web dashboard" width="660">
  &nbsp;
  <img src="docs/screenshots/mobile/dashboard-light.png" alt="Mobile dashboard" width="190">
</p>

## Screenshots

All screenshots use the seeded demo account (`cd server && npm run seed`), so
the data is fictional.

### Web

<table>
  <tr>
    <td align="center"><img src="docs/screenshots/web/desktop-light-dashboard.png" alt="Dashboard" width="400"><br><sub><b>Dashboard</b>: month-scoped KPIs and three aggregation-backed charts, each with a "view as table" twin</sub></td>
    <td align="center"><img src="docs/screenshots/web/desktop-dark-dashboard.png" alt="Dashboard, dark mode" width="400"><br><sub><b>Dark mode</b>: follows the system by default, with a System / Light / Dark switch</sub></td>
  </tr>
  <tr>
    <td align="center"><img src="docs/screenshots/web/desktop-light-transactions.png" alt="Transactions and budgets" width="400"><br><sub><b>Transactions + budgets</b>: the table is always on the left, with a tabbed panel on the right</sub></td>
    <td align="center"><img src="docs/screenshots/web/desktop-dark-transactions.png" alt="Transactions, dark mode" width="400"><br><sub><b>Transactions (dark)</b>: filter by type, category and date range; CSV import/export</sub></td>
  </tr>
  <tr>
    <td align="center"><img src="docs/screenshots/web/desktop-light-add-transaction.png" alt="Add transaction" width="400"><br><sub><b>Add transaction</b>: adding opens a popup</sub></td>
    <td align="center"><img src="docs/screenshots/web/desktop-light-edit-transaction.png" alt="Edit transaction" width="400"><br><sub><b>Edit transaction</b>: editing happens inline in the row</sub></td>
  </tr>
  <tr>
    <td align="center"><img src="docs/screenshots/web/desktop-light-recurring.png" alt="Recurring transactions" width="400"><br><sub><b>Recurring</b>: rules like "Every month" generate real transactions, with "run now" and pause/resume</sub></td>
    <td align="center"><img src="docs/screenshots/web/desktop-light-loans.png" alt="Loans" width="400"><br><sub><b>Loans</b>: lent or borrowed money as linked transactions, with repayments and write-off</sub></td>
  </tr>
  <tr>
    <td align="center"><img src="docs/screenshots/web/desktop-light-categories.png" alt="Categories" width="400"><br><sub><b>Categories</b>: names and colors for income and expenses</sub></td>
    <td align="center"><img src="docs/screenshots/web/desktop-light-import.png" alt="CSV import" width="400"><br><sub><b>CSV import</b>: column mapping, format detection, duplicate check and review</sub></td>
  </tr>
  <tr>
    <td align="center"><img src="docs/screenshots/web/desktop-light-login.png" alt="Login" width="400"><br><sub><b>Login</b>: with signup and emailed-code password reset</sub></td>
    <td></td>
  </tr>
</table>

**Responsive layout** (390 × 844):

<table>
  <tr>
    <td align="center"><img src="docs/screenshots/web/phone-light-dashboard.png" alt="Dashboard on a phone" width="250"><br><sub>Dashboard</sub></td>
    <td align="center"><img src="docs/screenshots/web/phone-light-transactions.png" alt="Transactions on a phone" width="250"><br><sub>Transactions</sub></td>
    <td align="center"><img src="docs/screenshots/web/phone-light-budgets.png" alt="Budgets on a phone" width="250"><br><sub>Budgets panel, stacked below the table</sub></td>
  </tr>
  <tr>
    <td align="center"><img src="docs/screenshots/web/phone-dark-dashboard.png" alt="Dashboard on a phone, dark mode" width="250"><br><sub>Dashboard (dark)</sub></td>
    <td align="center"><img src="docs/screenshots/web/phone-dark-transactions.png" alt="Transactions on a phone, dark mode" width="250"><br><sub>Transactions (dark)</sub></td>
    <td align="center"><img src="docs/screenshots/web/phone-dark-budgets.png" alt="Budgets on a phone, dark mode" width="250"><br><sub>Budgets (dark)</sub></td>
  </tr>
</table>

### Mobile

<!-- Mobile images are placeholders until real captures from Expo Go replace
     them. Overwrite each file in docs/screenshots/mobile/ (same name, under
     300 KB) and this table needs no changes. -->

<table>
  <tr>
    <td align="center"><img src="docs/screenshots/mobile/dashboard-light.png" alt="Mobile dashboard" width="250"><br><sub><b>Dashboard</b>: KPIs and charts drawn with plain React Native views</sub></td>
    <td align="center"><img src="docs/screenshots/mobile/dashboard-dark.png" alt="Mobile dashboard, dark mode" width="250"><br><sub><b>Dark mode</b></sub></td>
    <td align="center"><img src="docs/screenshots/mobile/transactions.png" alt="Mobile transactions" width="250"><br><sub><b>Transactions</b>: infinite scroll, filters, CSV export via the share sheet</sub></td>
  </tr>
  <tr>
    <td align="center"><img src="docs/screenshots/mobile/add-transaction.png" alt="Mobile add transaction" width="250"><br><sub><b>Add transaction</b>: native date picker</sub></td>
    <td align="center"><img src="docs/screenshots/mobile/budgets.png" alt="Mobile budgets" width="250"><br><sub><b>Budgets</b>: monthly limits per category</sub></td>
    <td align="center"><img src="docs/screenshots/mobile/recurring.png" alt="Mobile recurring" width="250"><br><sub><b>Recurring</b>: rules that add transactions automatically</sub></td>
  </tr>
  <tr>
    <td align="center"><img src="docs/screenshots/mobile/loans.png" alt="Mobile loans" width="250"><br><sub><b>Loans</b>: repayments and outstanding balance</sub></td>
    <td align="center"><img src="docs/screenshots/mobile/more.png" alt="Mobile more tab" width="250"><br><sub><b>More</b>: budgets, categories, recurring, appearance and log out</sub></td>
    <td></td>
  </tr>
</table>

## Tech stack

- **Client**: React 19, TypeScript, Vite, Tailwind CSS, React Router, TanStack Query, React Hook Form + Zod, Recharts
- **Server**: Node.js, Express, TypeScript, Mongoose, JWT auth (access + refresh tokens), Zod validation, node-cron
- **Database**: MongoDB (local via Docker, single-node replica set to support multi-document transactions)
- **Testing**: Vitest + Supertest (server integration tests against a real MongoDB), Vitest (shared, client and mobile unit tests)
- **Mobile**: Expo SDK 57 (React Native), Expo Router, expo-secure-store, TanStack Query, React Hook Form + Zod, native date picker; charts drawn with plain RN views (no chart library, runs in Expo Go)
- **Monorepo**: npm workspaces (`client/`, `server/`, `shared/`, `mobile/`)

## Why MongoDB?

This is the author's first project using a document database. The data model
deliberately contrasts two patterns: `Transaction` documents *reference*
`User`/`Category` by ObjectId (an unbounded, independently-growing collection —
the textbook case for referencing), while `RecurringTransaction` acts as a
small, stable template document that generates `Transaction` rows over time.
Budget-vs-actual spend and the dashboard charts are never denormalized —
they're computed live via MongoDB aggregation pipelines (`$match`, `$group`,
`$facet`, `$lookup`) so they can never go stale. Loans flip the pattern on its
head: a loan's repayments are bounded and always read with their parent, so
they're *embedded* subdocuments rather than referenced — and creating/repaying/
deleting a loan writes to both the loan and a linked transaction atomically via
a real MongoDB multi-document transaction. See
[docs/architecture.md](docs/architecture.md) for more detail.

## Project structure

```
budget-app/
├── client/     # React + Vite + TS frontend
├── server/     # Express + TS backend API
├── mobile/     # Expo (React Native) app — iOS/Android
├── shared/     # TS types shared by client, server (and mobile): enums + API request/response shapes
├── docs/       # architecture notes + screenshots
└── docker-compose.yml   # local MongoDB + Mailpit (email catcher) for development
```

## Getting started

**Prerequisites**: Node.js 20+, Docker Desktop.

```bash
# 1. Install dependencies (also builds the shared types package)
npm install

# 2. Copy env files and adjust if needed
cp server/.env.example server/.env
cp client/.env.example client/.env

# 3. Start local MongoDB (and Mailpit, which catches outgoing email)
npm run mongo:up

# 4. Start the app (shared types watcher + API + client, all together)
npm run dev
```

- Client: http://localhost:5173
- API: http://localhost:4000/api (health check at `/api/health`)
- Mailpit inbox (password reset codes land here): http://localhost:8025
- Mongo Express GUI (optional, to browse the database visually):
  `docker compose --profile tools up -d` → http://localhost:8081

### Mobile app (Expo)

1. Install **Expo Go** on your phone (App Store / Play Store). The phone and
   your computer must be on the same Wi-Fi network.
2. With the API running (`npm run dev`), start the Expo dev server in a second
   terminal:

   ```bash
   npm run dev:mobile
   ```

3. Scan the QR code it prints (iOS: Camera app; Android: from Expo Go).

The mobile app runs on a phone (or an Android emulator / iOS simulator) only.
Expo's web target isn't set up: it would need `react-native-web`, and
`expo-secure-store` has no browser implementation.

The app finds the API automatically: it uses the same LAN address Expo serves
the bundle from, on port 4000. To point it somewhere else (e.g. a deployed
API), set `EXPO_PUBLIC_API_URL=https://your-api/api` in `mobile/.env`.

On Windows, allow Node.js through the firewall on **private networks** the
first time, or the phone can't reach port 4000 (login shows "Can't reach the
server").

### Demo data

To try the app populated with a few months of realistic transactions, budgets,
and an active recurring rule, instead of an empty account:

```bash
cd server && npm run seed
```

Log in with **demo@example.com** / **password123**. Safe to re-run — it wipes
and recreates just that one demo account (already verified, so no "verify your
email" banner).

New sign-ups get a 6-digit code by email. Locally it lands in Mailpit at
http://localhost:8025.

### Upgrading an existing database (amounts in cents)

Amounts are stored and sent as integer cents (`amountCents: 125050` for
1250.50 — see [docs/architecture.md](docs/architecture.md#money-integer-cents)).
A database created before that change holds decimal amounts; convert it once:

```bash
# 1. Stop the API (npm run dev / the production process) so nothing writes meanwhile.
# 2. Optional: an extra full backup of your own, e.g.
#    docker compose exec mongo mongodump -u root -p changeme --authenticationDatabase admin --db budget-app --out /data/db/dump
cd server
npm run migrate:cents -- --dry-run   # report what would change; writes nothing
npm run migrate:cents                # back up, convert, verify totals
# 3. Start the API again.
```

It copies every affected collection to `<name>_backup_<stamp>` first, prints
each collection's total before and after, and exits non-zero if anything
doesn't match. Running it again is safe (it reports nothing to migrate). Undo
with `npm run migrate:cents -- --restore <stamp>`. In production use the
compiled script: `node dist/migrations/runAmountsToCents.js`. Once you've
checked the app, the `*_backup_*` collections can be dropped.

### Testing

```bash
npm test
```

Runs every suite: `shared` (money helpers), the server (Vitest + Supertest,
against a dedicated `budget-app-test` database on the same local Mongo
container — never your dev data), the web client and the mobile app's unit
tests. Requires `npm run mongo:up` first (only the server suite needs the
database).

### Production settings

With `NODE_ENV=production` the API refuses to start on development values
(placeholder or short JWT secrets, the default database password, a missing
`MAIL_FROM`/`SMTP_HOST`) and lists what to set. Behind a reverse proxy, set
`TRUST_PROXY` (e.g. `1`) so login rate limits see the real client IP — see
[server/.env.example](server/.env.example) and
[docs/architecture.md](docs/architecture.md#login-protection).

## Roadmap

- [x] M0 — Project scaffold, Docker Mongo, health check end-to-end
- [x] M1 — Mongo connection + User model
- [x] M2 — Auth (signup/login/refresh/logout)
- [x] M3 — Categories & Transactions CRUD
- [x] M4 — Budgets
- [x] M5 — Recurring transactions
- [x] M6 — Charts & dashboard
- [x] M7 — Polish, tests, seed data
- [x] M8 — Loans (money lent to / borrowed from someone — party, principal, running balance, repayments)
- [x] M9 — Password reset (emailed 6-digit code; works the same on web and mobile, no deep links needed)
- [x] M10 — Mobile-ready API (refresh token in the JSON body for mobile clients, cookie for web; API types moved into `shared/`)
- [x] M11 — Mobile app scaffold (Expo / React Native in `mobile/`, auth screens, secure token storage)
- [x] M12 — Mobile feature screens (tab bar; transactions, loans, budgets, categories, recurring; dashboard charts)

- [x] Dark mode (web + mobile: follows the system by default, with a System / Light / Dark switch)
- [x] CSV export of transactions (respects the current filters; web download, mobile share sheet)
- [x] CSV import (web + mobile): bank statements or this app's own export, with column mapping, date/number format detection, duplicate detection and a review step (parsing shared by both apps; mobile uses the system file picker)
- [x] CI (GitHub Actions): lint, typecheck, builds, Android bundle, and the full test suite against a MongoDB replica set on every push/PR
- [x] Money stored as whole cents, login rate limiting, production config checks
- [x] Profile & settings (web + mobile): name, display currency (PKR, USD, EUR, GBP, AED, SAR, INR), appearance, change password, change email (code to the new address), sign out of all devices, delete account
- [x] Email verification: 6-digit code at sign-up, a banner until verified; sign-up answers the same for new and registered emails
- [x] Full-data backup (web + mobile): one JSON file with everything; restore into an empty account or replace existing data, with a preview and a format version
- [x] Mobile date-range filter on transactions (this month, last month, last 3 months, custom)

**Future work**: live deployment (needed before the mobile app is usable off the local network), per-row category editing in the mobile import review.

## License

MIT — see [LICENSE](LICENSE).
