# SimplyAID

**Workplace first aid compliance & inventory management** — kits, batch-level stock, expiry tracking,
inspections, incidents and Factories Act, 1948 compliance (Sections 45 & 88) in one MERN application.

## Features

| Area | What it does |
|---|---|
| **First aid kits** | Create, edit, retire kits; contents list generated from the statutory Class A/B/C quantities; person in charge; QR labels; per-kit compliance score. |
| **Inventory** | Catalog of supplies (CRUD, archive) with stock aggregated live across all kits — search, filters, sorting, pagination, CSV export. |
| **Stock management** | Restock (new batch), use/dispense (earliest expiry first, never hands out expired units), corrections with a mandatory reason, remove expired batches, required quantity (low-stock threshold) per kit item. Quantities can never go negative. Every movement is written to an append-only ledger. |
| **Expiry tracking** | Every batch classified as expired / ≤ 7 days / ≤ 30 days / ≤ 90 days / healthy, with a 6-month outlook. Checked automatically on a schedule. |
| **Inspections** | Checklist pre-filled from recorded stock, deficiencies (resolvable later), suggested result, compliance snapshot stored with every inspection, next due date scheduled automatically. |
| **Compliance** | Kit scores from four defined rules plus six statutory checks (see below), department view, action items, PDF report. |
| **Incidents** | Self-reported, manager-assisted and SOS incidents; manager confirmation and doctor review workflow; supplies used are deducted from the kit exactly once; Form 18 PDF for reportable accidents. |
| **Treatments** | Treatment records by doctors with automatic stock deduction. |
| **Notifications** | Low stock, missing supplies, expired / expiring stock, overdue inspections, compliance failures, certification expiry, incidents and SOS. Read/unread, archive, bulk actions, deep links. **Never duplicated** by repeated checks. |
| **People & roles** | Create accounts, edit details, assign roles, deactivate/reactivate, reset passwords, first-aid certification tracking. |
| **Reports** | Inventory, low stock, expiry, compliance, inspection history, stock movements, accident register, activity — preview in the app, export **CSV** or **PDF**. |
| **Activity log** | Who did what to which record and when, with field-level changes. Read-only. |
| **Global search** | `Ctrl/⌘ + K` searches kits, inventory, incidents and people. |

## Roles

| Role | Can |
|---|---|
| **Admin** | Everything, including granting the admin role and editing statutory (global) catalog items. |
| **Doctor** | Medical lead: inventory, kits, expiry, compliance, inspections, treatments, reports, activity log, departments and user management (cannot create or modify admins). |
| **Manager** | Their own department: dashboard, kits (inspect, restock), incidents (confirm / fill on-site), employees, reports. |
| **Employee** | Report incidents and SOS, see their own incidents, scan QR codes, manage their own profile. |

Permissions are enforced by the API on every endpoint; the UI only hides what a role can't use.

## Compliance rules

Each kit is scored out of 100:

| Rule | Weight | Measured as |
|---|---|---|
| Supplies | 40 | Share of required items held at or above the required quantity |
| Expiry | 25 | Full marks only if the kit holds no expired units |
| Inspection | 20 | Inspected, and the next inspection is not overdue |
| Person in charge | 15 | Certified first-aider assigned (half if assigned but not certified) |

≥ 90 compliant · ≥ 70 at risk · below 70 non-compliant. Regardless of score, **any expired units → non-compliant**,
and **any required item completely missing → at best at risk**.

The company score is 50 % the average kit score and 50 % six statutory checks, each scored as the share that complies:
one kit per 150 workers (Section 45(1)), kits fully stocked, no expired supplies, inspections on schedule,
certified person in charge (Section 45(2)), Form 18 filed for reportable accidents (Section 88).

## Getting started

**Requirements:** Node.js **22.12+** (or 20.19+; Vite 8 requirement) and MongoDB 6+.
No MongoDB installed? `npm run dev:mongo` starts a temporary in-memory MongoDB (data is lost when it stops).

```bash
npm run install:all                  # installs server and client dependencies
cp .env.example server/.env          # then set JWT_SECRET (and MONGO_URI if needed)
npm run seed                         # ⚠ wipes the database and loads demo data
```

Run the API and the web app in two terminals:

```bash
npm run server     # http://localhost:5000
```

```bash
npm run client     # http://localhost:5173
```

Demo accounts (after seeding) all use the password `Demo@123`, e.g. `admin@simplyaid.com`, `arun@simplyaid.com` (doctor),
`vikram@simplyaid.com` (manager), `ravi@simplyaid.com` (employee). The company code for self sign-up is `DMPL`.
Set `ENABLE_DEMO_LOGIN=true` to show the one-click demo panel on the sign-in page (development only).

### Tests

```bash
npm test
```

Runs 40 API/integration tests against an isolated in-memory MongoDB: authentication, authorization and tenant isolation,
inventory CRUD, stock integrity (FIFO, no negatives, no lost concurrent updates, no resurrected stock), expiry, the
monitoring job and alert de-duplication, the incident workflow, inspections and compliance, notifications, user/role
management, the activity log and report exports.

### Production

```bash
npm run build                         # builds client/dist
NODE_ENV=production npm start         # serves the API and the built client on PORT
```

In production the server refuses to start without a strong `JWT_SECRET` or with `ENABLE_DEMO_LOGIN=true`, and error
responses never include internal details. Put it behind HTTPS and set `TRUST_PROXY` when behind a proxy.

## Architecture

```
server/
  app.js                 Express app (security headers, CORS, rate limits, body sanitising, routes, error handler)
  server.js              Startup: env validation → DB → migrations/indexes → listen → scheduler
  config/                env validation, roles, constants, idempotent data migrations
  models/                Mongoose schemas (FirstAidBox holds batches; StockTransaction & AuditLog are append-only)
  services/              stockService (the only code that changes kit quantities), complianceService,
                         expiryService, inventoryService, monitoringService (alerts + scheduler), reportService
  controllers/ routes/   HTTP layer; validation with express-validator
  tests/                 node:test + supertest + mongodb-memory-server
client/src/
  components/ui          Design-system components (cards, badges, tables, modals, confirm dialog, skeletons…)
  components/layout      Sidebar, top bar, global search, error boundary
  pages/                 One file per screen, lazy-loaded
  services/api.js        Axios client
```

**Data integrity:** a kit item's quantity is always the sum of its batches; kits use optimistic concurrency so simultaneous
updates are retried rather than lost; company-wide inventory totals are computed from kits, so the catalog and kits can't
drift apart; incident stock deduction is claimed atomically so it happens exactly once.

**Scheduling:** `monitoringService` checks every 15 minutes whether a run is due (`MONITOR_INTERVAL_HOURS`, default 24 if
unset). The run is claimed atomically in the database, so with several server instances only one executes it.
Alerts carry a de-duplication key, so re-running never produces duplicates.

Bilingual UI labels (English/हिन्दी) are available for the parts of the interface that have translations.

## License

MIT
