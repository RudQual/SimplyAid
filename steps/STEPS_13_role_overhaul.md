# Step 13: Doctor / Manager / User Role Overhaul

## What Changed
We replaced the old role system (`admin`, `worker`, `supervisor`, `safety_officer`) with a new three-role system: **Doctor**, **Manager**, and **User**. We also removed the **Vending Machine** entirely and built a new **Incident Confirmation Workflow**.

---

## New Workflow
1. **User** reports an incident (e.g., took medicine from a First Aid Box)
2. **Manager** receives a notification, goes on-site, confirms the incident, adds notes, and forwards it to the Doctor
3. **Doctor** reviews the final report, adds medical assessment, and resolves the incident

---

## Backend Changes

### 1. Updated User Roles (`server/models/User.js`)
- Changed role enum from `['admin', 'employee', 'worker', 'supervisor', 'safety_officer']` to `['doctor', 'manager', 'user']`
- Default role changed from `'worker'` to `'user'`

### 2. Updated Incident Model (`server/models/Incident.js`)
- Added `managerConfirmation` field (confirmedBy, notes, confirmedAt)
- Added `doctorReview` field (reviewedBy, notes, reviewedAt)
- Added `forwardedToDoctor` boolean flag

### 3. Updated Incident Routes (`server/routes/incidentRoutes.js`)
- Added `PUT /:id/manager-confirm` — Manager confirms incident on-site
- Added `PUT /:id/doctor-review` — Doctor reviews and resolves incident
- Update incident now restricted to `manager` and `doctor` roles

### 4. Updated Incident Controller (`server/controllers/incidentController.js`)
- Added `managerConfirm()` — Sets status to `under_investigation`, notifies doctors
- Added `doctorReview()` — Sets status to `resolved`
- Changed notification target from `admin` to `manager`

### 5. Re-enabled Auth Middleware (`server/middleware/auth.js`)
- The `authorize()` function was previously disabled (all roles allowed everything)
- Now properly checks if `req.user.role` is in the allowed roles list

### 6. Updated Inventory Routes (`server/routes/inventoryRoutes.js`)
- Changed all `authorize('admin')` to `authorize('doctor')` — only doctors can manage inventory

### 7. Removed Vending Machine
- Deleted `server/routes/vendingRoutes.js`
- Deleted `server/controllers/vendingController.js`
- Removed vending route registration from `server/server.js`

---

## Frontend Changes

### 8. Re-enabled Role Checking (`client/src/contexts/AuthContext.jsx`)
- `hasRole()` now actually checks `user.role` instead of always returning `true`

### 9. Updated Login Page (`client/src/pages/Login.jsx`)
- Role dropdown changed from Worker/Supervisor/Safety Officer/Admin to **User (Worker) / Manager / Doctor**

### 10. Role-Based Sidebar (`client/src/components/common/Sidebar.jsx`)
- **User sees:** Dashboard, Incidents, Report Incident, QR Scanner
- **Manager sees:** + Confirmations dashboard, Employees, Reports
- **Doctor sees:** + Doctor Dashboard, Treatments, Inventory, Expiry, Prescriptions, Compliance, Analytics, AI Assistant, Departments, Settings

### 11. Updated App Router (`client/src/App.jsx`)
- Removed VendingMachine route and import
- Re-enabled role checks in `ProtectedRoute` and `GuestableRoute`
- Added `/manager-dashboard` and `/doctor-dashboard` routes

### 12. New Manager Dashboard (`client/src/pages/ManagerDashboard.jsx`)
- Shows all `reported` incidents pending confirmation
- Modal to add on-site notes and forward to doctor

### 13. New Doctor Dashboard (`client/src/pages/DoctorDashboard.jsx`)
- Stats cards (Awaiting Review, Total 30d, Resolved, Days Lost)
- Quick action buttons (Inventory, Expiry, Prescriptions, Reports)
- Shows `under_investigation` incidents (confirmed by manager) awaiting doctor review
- Modal for medical assessment notes

### 14. Updated API Service (`client/src/services/api.js`)
- Removed `vendingLogin` and `vendingDispense`
- Added `managerConfirmIncident(id, data)` and `doctorReviewIncident(id, data)`

### 15. Deleted Vending Machine Frontend
- Deleted `client/src/pages/VendingMachine.jsx`
- Deleted `client/src/pages/VendingMachine.css`

---

## Commands Used
```bash
# Start backend
cd server && npm run dev

# Start frontend
cd client && npm run dev

# Git commit
git add -A
git commit -m "feat: Doctor/Manager/User role overhaul - remove vending machine, add incident confirmation flow, role-based navigation and dashboards"
```

## Testing
1. Sign up as each role (User, Manager, Doctor) to verify role-based navigation
2. As User: Report a new incident
3. As Manager: View the incident in Confirmations dashboard, add notes, send to doctor
4. As Doctor: Review the incident in Doctor Dashboard, add assessment, resolve
