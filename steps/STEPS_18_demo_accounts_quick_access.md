# STEPS 18: Demo Accounts & Quick-Access Login Panel

## Goal
Delete all existing accounts and create 10 pre-seeded demo accounts organized by department with a clear role hierarchy (Employee → Manager → Doctor). Add a quick-access dropdown panel on the Login page for instant account switching.

---

## Step 1: Rewrote Seed Data (`server/seeds/seedData.js`)

### What Changed
- Clears ALL collections (Users, Incidents, Treatments, Notifications, QrScanLogs, Inspections, AuditLogs, etc.) for a clean slate.
- Creates 10 demo accounts across 4 departments:
  - **4 Employees**: Ravi Kumar, Anita Sharma, Sunil Yadav, Kavita Nair
  - **3 Managers** (incl. Head Manager): Vikram Patel, Deepak Joshi, Rajesh Gupta (★ Head)
  - **2 Doctors** (incl. Head Doctor): Dr. Meena Iyer, Dr. Arun Desai (★ Head)
- All accounts use password: `Demo@123`
- Sets `headOfDepartment` on departments (ADMIN→Rajesh, PROD→Vikram, MAINT→Deepak)
- Keeps inventory items and first-aid boxes.

### Command
```bash
node server/seeds/seedData.js
```

---

## Step 2: Added Quick-Login API (Server-Side)

### `server/controllers/authController.js`
- Added `quickLogin` controller: accepts `{ email }` only, returns JWT + user data without password check.
- Gated behind `NODE_ENV !== 'production'` for security.
- Added `getDemoAccounts` controller: returns all active users with name, email, role, department for the dropdown.

### `server/routes/authRoutes.js`
- Added routes:
  - `POST /api/auth/quick-login` → quickLogin
  - `GET /api/auth/demo-accounts` → getDemoAccounts

---

## Step 3: Updated Client API & Auth Context

### `client/src/services/api.js`
- Added `quickLoginUser(data)` → calls `POST /api/auth/quick-login`
- Added `getDemoAccountsList()` → calls `GET /api/auth/demo-accounts`

### `client/src/contexts/AuthContext.jsx`
- Added `quickLoginByEmail(email)` method for passwordless demo login.
- Added `getRoleRedirect(role)` helper that returns the correct route per role:
  - `employee` → `/` (Dashboard)
  - `manager` → `/manager-dashboard`
  - `doctor` → `/doctor-dashboard`
- Updated the Provider to expose both new methods.

---

## Step 4: Rewrote Login Page (`client/src/pages/Login.jsx`)

### Layout
- **Left side**: Original login form (completely untouched — email/password/signup still works)
- **Right side**: New "Quick Access" demo panel

### Quick Access Panel Features
- Accounts grouped by role in collapsible accordion sections: Employees, Managers, Doctors
- Each account shows: avatar (colored by role), name, designation, department
- Head Manager and Head Doctor get a gold ★ HEAD badge
- Clicking any account instantly logs in via `quickLoginByEmail()`
- Loading spinner shows on the clicked card while authenticating
- Panel footer shows the shared password: `Demo@123`

### Role-based redirect
After any login (normal form OR quick-access), the user is redirected based on role:
- Employee → `/` (general Dashboard)
- Manager → `/manager-dashboard`
- Doctor → `/doctor-dashboard`

---

## Step 5: Updated Login CSS (`client/src/pages/Login.css`)

- Changed `.login-page` layout to side-by-side using flexbox (`.login-layout`)
- Styled the demo panel card with glassmorphism (same look as login card)
- Role group headers with colored icons (blue=employee, amber=manager, green=doctor)
- Accordion expand/collapse animation
- Account buttons with hover effects and arrow indicators
- ★ HEAD badge with gradient background
- Responsive: stacks vertically below 820px, tighter padding below 480px

---

## Step 6: Role-Based Home Redirect (`client/src/App.jsx`)

- Added `RoleRedirectHome` component on the `/` route
- If user is a `manager` → redirects to `/manager-dashboard`
- If user is a `doctor` → redirects to `/doctor-dashboard`
- If user is an `employee` or guest → stays on Dashboard

---

## Step 7: Updated Role References Across Codebase

### `server/models/User.js`
- Changed default role from `'user'` to `'employee'`

### `server/controllers/authController.js` (signup)
- Updated allowed roles from `['doctor', 'manager', 'user']` to `['doctor', 'manager', 'employee']`
- Default signup role changed to `'employee'`

### `client/src/components/common/Sidebar.jsx`
- "Report Incident" sidebar link: roles changed from `['user', 'manager']` to `['employee', 'manager']`

### `client/src/pages/Employees.jsx`
- Role dropdown in employee creation form: `User` → `Employee`

---

## Hierarchy Summary

```
Employee (base level)
  ├── Can: View dashboard, report incidents, scan QR, view profile
  │
Manager (middle tier)
  ├── Can: Everything employee can + confirmations, inventory, employees, reports, analytics
  ├── Head Manager: Same permissions, distinguished by designation
  │
Doctor (top tier)
  ├── Can: Everything + treatments, compliance, medical profiles, AI assistant
  ├── Head Doctor: Same permissions, distinguished by designation
```

---

## Files Changed
1. `server/seeds/seedData.js` — Complete rewrite with 10 accounts
2. `server/controllers/authController.js` — Added quickLogin + getDemoAccounts
3. `server/routes/authRoutes.js` — Added 2 new routes
4. `server/models/User.js` — Default role → employee
5. `client/src/services/api.js` — Added 2 API functions
6. `client/src/contexts/AuthContext.jsx` — Added quickLoginByEmail + getRoleRedirect
7. `client/src/pages/Login.jsx` — Complete rewrite with demo panel
8. `client/src/pages/Login.css` — Complete rewrite with side-by-side layout
9. `client/src/App.jsx` — Added RoleRedirectHome component
10. `client/src/components/common/Sidebar.jsx` — Role fix: user → employee
11. `client/src/pages/Employees.jsx` — Role fix in create form
