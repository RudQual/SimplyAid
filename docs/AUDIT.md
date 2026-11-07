# SimplyAID — audit & remediation log

Baseline: `rudqual/master` @ `5d3d20a`. Each item lists what was found and how it was resolved.

## Security

| # | Finding | Severity | Resolution |
|---|---|---|---|
| S1 | `POST /api/auth/register` was public: anyone could create an account with **any role** in any company. | Critical | Requires sign-in as doctor/admin; role rules enforced (`userController.createUser`). |
| S2 | `POST /api/auth/signup` accepted `role: "doctor"/"manager"` and silently joined the first company. | Critical | Always creates an *employee*; requires a valid company code; can be disabled (`ALLOW_SELF_SIGNUP`). |
| S3 | Password-less quick-login and the full user list (`/demo-accounts`) were enabled whenever `NODE_ENV` wasn't exactly `production`. | Critical | Off unless `ENABLE_DEMO_LOGIN=true`; refused in production; server won't start with it in production. |
| S4 | `server/.env` (incl. `JWT_SECRET`) and 7,646 `node_modules` files were committed. | High | Untracked. **The old secret is still in Git history — treat it as compromised.** |
| S5 | Cross-company data access (IDOR): most `findById` lookups ignored the user's company (users, incidents, kits, inspections, treatments, medical profiles, departments, scanners, companies). | High | Every lookup is company-scoped; out-of-company ids return 404. Covered by tests. |
| S6 | `PUT /api/employees/profile/:id` let any manager overwrite **any field** (role, company, isActive, email…) of any user, including themselves. | High | Explicit field whitelists; roles/status only via `/api/users` with role rules. |
| S7 | `PUT /api/users/:id` mass assignment (role, company, password hash fields) by any manager. | High | Field whitelist; only admins grant/revoke admin; no one changes their own role; managers limited to their department's employees. |
| S8 | `POST /api/employees/qr/:id/regenerate` had no authorization check. | Medium | Self, admin/doctor, or the user's department manager only. |
| S9 | QR validation "auto-healed" a missing `qrCodeId` from the scanned payload and searched across companies (forged QR accepted). | Medium | Company-scoped; a stale/foreign `qrCodeId` is rejected. |
| S10 | QR lookup returned the full profile (incl. medical data) to any employee. | Medium | Non-managers receive the emergency subset only. |
| S11 | Treatments (medical records), scan history and analytics readable by every user. | Medium | Restricted by role; employees see only their own treatment history. |
| S12 | NoSQL operator injection possible through JSON bodies (e.g. login `{"email":{"$ne":null}}`). | Medium | `$`/`.` keys stripped from bodies; type checks on auth inputs. Tested. |
| S13 | Unescaped user input in `$regex` searches (ReDoS / regex injection). | Medium | All searches use escaped, length-limited patterns. |
| S14 | No rate limiting; no token revocation after password change; JWT algorithm not pinned; weak/missing secret accepted. | Medium | Rate limits on auth & API; tokens issued before a password change are rejected; HS256 pinned; env validation at startup. |
| S15 | 500 responses leaked internal error messages; inconsistent status codes (validation → 400 only for some, duplicates → 400). | Low | Central error handler: safe messages in production, 409 for duplicates/conflicts, 404 for bad ids. |
| S16 | Profile photo replacement deleted a path built from a DB field. | Low | Deletion constrained to the uploads directory. |
| S17 | Password policy was 6 characters. | Low | 8+ characters with a letter and a number for new passwords. |

## Data integrity & business logic

| # | Finding | Resolution |
|---|---|---|
| D1 | Incident supplies were deducted from the kit **up to three times** (on create, manager confirm and doctor review). | `stockDeducted` flag claimed atomically; deduction happens once. Legacy incidents marked by migration. |
| D2 | Treatments deducted only the legacy `currentQty` while status was computed from batches — stock never actually decreased. | All deductions go through `stockService` (batch-aware, FIFO by expiry). |
| D3 | Quantities could go negative / non-integer; expired stock could be added; concurrent updates overwrote each other. | Validation in the stock service, optimistic concurrency with retry/backoff, append-only `StockTransaction` ledger. |
| D4 | The scheduled expiry job and the manual check created **duplicate notifications on every run**. | Dedupe keys + unique index per recipient; re-runs never duplicate. |
| D5 | Compliance ignored batch expiry (only the legacy single date) and three different scoring formulas existed (compliance page, analytics, reports). | One `complianceService` with documented rules used everywhere. |
| D6 | Box status only considered overdue inspection and stock — expired items never affected status. | Status: inactive → items_expired → overdue_inspection → needs_replenishment → adequate. |
| D7 | Sequential IDs (`INC-2026-0001`) came from `countDocuments()+1` — duplicates under concurrency or after deletions. | Atomic counters initialised from the highest existing ID. |
| D8 | `MedicalProfile` pre-save hook called `next()`, which Mongoose 9 no longer provides — saving a medical profile threw. | Fixed hook. |
| D9 | Form 18 could never be generated, so the "pending Form 18" compliance check could never pass. | Form 18 PDF endpoint marks the incident as filed. |
| D10 | Notifications were created without a category, so category filters never matched. | Category/priority/link set on creation; old records back-filled. |
| D11 | Incident creation fell back to *any* department of *any* company when none was given. | Department required (defaults to the reporter's). |
| D12 | `qrCodeId` partial index used `$ne: null`, which MongoDB rejects, so the uniqueness index was never created. | `$type: 'string'`; startup migration rebuilds conflicting indexes. |
| D13 | Found during UI testing: removing an item's last batch let the legacy migration hook resurrect the stock on save. | Migration runs on load only; regression tests added. |

## Broken / placeholder features

| # | Finding | Resolution |
|---|---|---|
| F1 | AI Assistant returned canned "simulated" responses. | Removed (no fake functionality). |
| F2 | `/api/prescriptions` were stubs returning empty data / 501; the employee profile showed an always-empty "Active prescriptions" tab and the client called a non-existent route. | Stub routes, client calls and tab removed. |
| F3 | Settings (incl. change password) was doctor-only — managers and employees couldn't change their password. | Available to everyone. |
| F4 | "Guest mode" rendered pages that fired API calls, received 401 and bounced to login. | All app routes require sign-in; `?next=` return path. |
| F5 | A wrong password on the login page triggered the global 401 redirect. | Auth calls are excluded from the session-expired redirect. |
| F6 | No inventory catalog management (only create), no kit create/delete UI, no stock movement history, no item detail, no inspection history/detail, no user creation/role/deactivation UI, no activity log UI, no report exports beyond a client-side table. | Implemented (see README). |
| F7 | Manager "inspect" logged an inspection without creating an `Inspection` record. | Quick inspection records a full inspection. |
| F8 | Analytics inspection completion rate counted inspections (could exceed 100 %). | Counts distinct kits inspected. |

## Code quality

- Introduced a service layer; removed duplicated deduction/expiry/compliance logic (4 copies → 1 each).
- Express 5 async error propagation instead of ad-hoc try/catch in new code; consistent `{ success, data, message }` responses with pagination metadata.
- Removed unused server dependencies (`apple-signin-auth`, `google-auth-library`, `json2csv`, `exceljs`, `uuid`); added `express-rate-limit`; test-only `mongodb-memory-server`, `supertest`.
- Front end: design system (`index.css`), shared UI components, `useAsync` (ignores stale responses), lazy-loaded pages, error boundary.

## Remaining limitations

- `JWT_SECRET` from the old committed `.env` is in Git history: rotate it on every deployment that used it.
- Tokens are stored in `localStorage` (as before). An httpOnly-cookie session would further reduce XSS impact.
- English/Hindi translation covers only the labels that existed in `translations.js`; new screens are English.
- No e-mail/SMS delivery: alerts are in-app. A notifier can be added in `utils/notificationService.createAlert`.
- No end-to-end browser test suite; the UI was verified manually (desktop and mobile widths) against the seeded data.
