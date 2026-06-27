# STEP 13: Backend Role Overhaul — Doctor/Manager/User

## What Changed
Replaced the old 5-role system (admin, employee, worker, supervisor, safety_officer) with a
simplified 3-role system: **doctor**, **manager**, **user**. Added incident confirmation workflow
where managers confirm on-site and doctors do final review.

---

## 13.1 Updated User Roles (server/models/User.js)

**What:** Changed the `role` enum from `['admin', 'employee', 'worker', 'supervisor', 'safety_officer']`
to `['doctor', 'manager', 'user']`. Changed default from `'worker'` to `'user'`.

**Why?** The old roles were too many and unclear. The new roles match the real workflow:
- **user** — Regular worker/employee who reports incidents
- **manager** — On-site supervisor who confirms incidents and manages operations
- **doctor** — Medical professional who reviews and resolves incidents

---

## 13.2 Added Manager/Doctor Fields to Incident Model (server/models/Incident.js)

**What:** Added three new fields after `closedAt`:
```javascript
managerConfirmation: {
  confirmedBy: ObjectId (ref User),
  notes: String,
  confirmedAt: Date
}
doctorReview: {
  reviewedBy: ObjectId (ref User),
  notes: String,
  reviewedAt: Date
}
forwardedToDoctor: Boolean (default: false)
```

**Why?** These fields track the incident confirmation workflow:
1. User reports an incident → status: `reported`
2. Manager confirms on-site → status: `under_investigation`, `forwardedToDoctor` = true
3. Doctor reviews → status: `resolved`

---

## 13.3 Updated Incident Routes (server/routes/incidentRoutes.js)

**What:** Replaced the entire routes file to:
- Import new controller functions (`managerConfirm`, `doctorReview`)
- Change PUT `/:id` authorization from `authorize('admin')` to `authorize('manager', 'doctor')`
- Add `PUT /:id/manager-confirm` — managers only
- Add `PUT /:id/doctor-review` — doctors only

**How routes look now:**
```
GET    /stats/summary          → any authenticated user
GET    /                       → any authenticated user (list incidents)
POST   /                       → any authenticated user (report incident)
GET    /:id                    → any authenticated user (view incident)
PUT    /:id                    → manager or doctor only (general update)
PUT    /:id/manager-confirm    → manager only
PUT    /:id/doctor-review      → doctor only
```

---

## 13.4 Added Controller Functions (server/controllers/incidentController.js)

**What:** Added two new exported functions:

### `managerConfirm`
- Finds incident by ID
- Sets `managerConfirmation` with confirming user, notes, timestamp
- Sets `forwardedToDoctor = true`
- Changes status to `under_investigation`
- Pushes to `statusHistory`
- **Notifies all doctors** in the same company via Notification model
- Returns populated incident

### `doctorReview`
- Finds incident by ID
- Sets `doctorReview` with reviewing user, notes, timestamp
- Changes status to `resolved`
- Pushes to `statusHistory`
- Returns populated incident

Also changed `notifyRoles` in `createIncident` from `['admin']` to `['manager']` so managers
get notified when new incidents are reported.

---

## 13.5 Re-enabled Role Authorization (server/middleware/auth.js)

**What:** The `authorize()` middleware was previously disabled (commented out) with a note
"TEMPORARILY DISABLED". We re-enabled it so it now actively checks `req.user.role` against
the allowed roles and returns 403 Forbidden if the user's role isn't authorized.

**Why?** With the new role system in place, we need proper access control enforcement.

---

## 13.6 Removed Vending Machine Feature

**What:**
- Removed `app.use('/api/vending', require('./routes/vendingRoutes'))` from `server/server.js`
- Deleted `server/routes/vendingRoutes.js`
- Deleted `server/controllers/vendingController.js`

**Why?** The vending machine feature is being removed from the application scope.

---

## 13.7 Git Commit

```bash
git add -A
git commit -m "feat: Backend role overhaul - doctor/manager/user roles, incident confirmation flow, remove vending"
```

---

## Key Concepts for Beginners

### Role-Based Access Control (RBAC)
The `authorize('manager', 'doctor')` middleware checks if the logged-in user has the right role.
If not, it returns a 403 (Forbidden) error. This is how we protect certain API endpoints so
only authorized users can access them.

### Incident Workflow
The new flow follows a real-world pattern:
1. **User reports** → Incident created with status `reported`
2. **Manager goes on-site** → Confirms the incident, adds notes → Status becomes `under_investigation`
3. **Doctor reviews** → Provides medical assessment → Status becomes `resolved`

### Notifications
When a manager confirms an incident, the system automatically creates notification records
for all active doctors in the same company. This is done by querying the User model for
users with `role: 'doctor'` and creating Notification documents via `insertMany()`.
