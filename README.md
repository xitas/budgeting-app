# Budget App

A personal budget management web app — track income and expenses, set monthly
budgets per category, automate recurring transactions, and visualize spending
with charts.

Built as a learning project for MongoDB/Mongoose (schema design, indexes,
aggregation pipelines) and as a portfolio piece.

## Tech stack

- **Client**: React, TypeScript, Vite, Tailwind CSS, React Router, TanStack Query, React Hook Form + Zod, Recharts
- **Server**: Node.js, Express, TypeScript, Mongoose, JWT auth (access + refresh tokens), Zod validation
- **Database**: MongoDB (local via Docker for development)
- **Monorepo**: npm workspaces (`client/`, `server/`, `shared/`)

## Why MongoDB?

This is the author's first project using a document database. The data model
deliberately contrasts two patterns: `Transaction` documents *reference*
`User`/`Category` by ObjectId (an unbounded, independently-growing collection —
the textbook case for referencing), while `RecurringTransaction` acts as a
small, stable template document. Budget-vs-actual spend is never denormalized
— it's computed live via MongoDB aggregation pipelines (`$match`, `$group`,
`$facet`) so it can never go stale. See [docs/architecture.md](docs/architecture.md)
for more detail.

## Project structure

```
budget-app/
├── client/     # React + Vite + TS frontend
├── server/     # Express + TS backend API
├── shared/     # TS types shared between client and server
└── docker-compose.yml   # local MongoDB for development
```

## Getting started

**Prerequisites**: Node.js 20+, Docker Desktop.

```bash
# 1. Install dependencies (also builds the shared types package)
npm install

# 2. Copy env files and adjust if needed
cp server/.env.example server/.env
cp client/.env.example client/.env

# 3. Start local MongoDB
npm run mongo:up

# 4. Start the app (shared types watcher + API + client, all together)
npm run dev
```

- Client: http://localhost:5173
- API: http://localhost:4000/api (health check at `/api/health`)
- Mongo Express GUI (optional, to browse the database visually):
  `docker compose --profile tools up -d` → http://localhost:8081

## Roadmap

- [x] M0 — Project scaffold, Docker Mongo, health check end-to-end
- [x] M1 — Mongo connection + User model
- [x] M2 — Auth (signup/login/refresh/logout)
- [x] M3 — Categories & Transactions CRUD
- [ ] M4 — Budgets
- [ ] M5 — Recurring transactions
- [ ] M6 — Charts & dashboard
- [ ] M7 — Polish, tests, seed data

**Future work**: password reset, CSV import/export, dark mode, CI (GitHub Actions), live deployment.

## License

MIT
