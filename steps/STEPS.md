# SimplyAID — Build Steps Documentation

## What is SimplyAID?
A MERN stack (MongoDB, Express.js, React, Node.js) web application for managing
workplace first aid operations. It follows Indian Factories Act, 1948 compliance
requirements (Section 45 — First Aid Boxes, Section 88 — Accident Reporting).

---

## STEP 1: Project Initialization

### 1.1 Create project folder & Git
```bash
mkdir SimplyAID
cd SimplyAID
git init
```
**Why?** Git tracks every change we make so we can revert if something breaks.

### 1.2 Create .gitignore
Created `.gitignore` to exclude `node_modules/`, `.env`, build files, and IDE files.
**Why?** We don't want to push sensitive data or huge dependency folders to Git.

### 1.3 Create .env.example
A template showing what environment variables are needed. The actual `.env` file
is gitignored for security. Variables include:
- `PORT` — Server port (5000)
- `MONGO_URI` — MongoDB connection string
- `JWT_SECRET` — Secret key for token signing
- `CLIENT_URL` — Frontend URL for CORS

---

## STEP 2: Backend Setup (Express + MongoDB)

### 2.1 Initialize server
```bash
mkdir server
cd server
npm init -y   # Creates package.json
```
Edit `package.json` to add scripts:
- `npm run dev` → runs `nodemon server.js` (auto-restart on changes)
- `npm run seed` → runs `node seeds/seedData.js` (populate DB with demo data)

### 2.2 Install dependencies
```bash
npm install express mongoose dotenv cors bcryptjs jsonwebtoken express-validator multer pdfkit json2csv exceljs helmet morgan
npm install -D nodemon
```

| Package | Purpose |
|---------|---------|
| `express` | Web framework — handles HTTP requests |
| `mongoose` | MongoDB ODM — defines schemas & interacts with DB |
| `dotenv` | Loads `.env` variables into `process.env` |
| `cors` | Allows frontend (port 5173) to call backend (port 5000) |
| `bcryptjs` | Hash passwords before storing in DB |
| `jsonwebtoken` | Create JWT tokens for authentication |
| `helmet` | Adds security headers to HTTP responses |
| `morgan` | Logs HTTP requests in development |
| `nodemon` | Auto-restarts server when files change (dev only) |

### 2.3 Create folder structure
```
server/
├── config/      → Database connection
├── controllers/ → Business logic (what happens when API is called)
├── middleware/   → Auth checks, error handling
├── models/      → Mongoose schemas (database structure)
├── routes/      → URL endpoint definitions
├── utils/       → Helper functions (PDF generation, etc.)
├── seeds/       → Sample data for testing
└── server.js    → Entry point
```

### 2.4 Database Connection (`config/db.js`)
Uses `mongoose.connect()` with the URI from `.env`.
**Key concept:** Mongoose connects to MongoDB and lets us define schemas
(like blueprints) for our data.

### 2.5 Models (Database Schemas)
Each model defines the structure of a "collection" (like a table in SQL):

| Model | File | Purpose |
|-------|------|---------|
| Company | `models/Company.js` | Multi-company support |
| Department | `models/Department.js` | Org structure |
| User | `models/User.js` | Employees with roles |
| Incident | `models/Incident.js` | Accident/injury records |
| FirstAidBox | `models/FirstAidBox.js` | Box inventory tracking |
| InventoryItem | `models/InventoryItem.js` | Item type definitions |
| Notification | `models/Notification.js` | Alert system |

**Key patterns used:**
- `ref: 'Model'` → Links one model to another (like foreign keys)
- `pre('save')` → Runs code before saving (e.g., hash password, auto-generate ID)
- `select: false` → Hides field by default in queries (used for password)

### 2.6 Middleware
- **`auth.js`** — Verifies JWT token from `Authorization: Bearer <token>` header.
  `protect` checks if user is logged in, `authorize('admin')` checks role.
- **`errorHandler.js`** — Catches all errors and sends clean JSON responses.

### 2.7 Controllers (Business Logic)
Each controller handles the logic for its resource:
- `authController` — Register, Login (returns JWT), Get profile, Change password
- `incidentController` — CRUD + auto-notifications + statistics aggregation
- `inventoryController` — Box management, inspection logging, replenishment
- `reportController` — Compliance checks, department summaries, accident register

### 2.8 Routes (URL Mapping)
Each route file maps HTTP methods to controller functions:
```
POST /api/auth/login    → authController.login
GET  /api/incidents     → incidentController.getIncidents
PUT  /api/incidents/:id → incidentController.updateIncident (admin/safety only)
```

### 2.9 Server Entry Point (`server.js`)
Ties everything together:
1. Load environment variables
2. Connect to MongoDB
3. Setup middleware (helmet, cors, morgan, JSON parsing)
4. Mount routes at `/api/*`
5. Add error handler
6. Start listening on PORT

---

## STEP 3: Frontend Setup (React + Vite)

### 3.1 Create Vite project
```bash
cd ..  # back to SimplyAID root
npx -y create-vite@latest client -- --template react
cd client
npm install
```

### 3.2 Install frontend packages
```bash
npm install react-router-dom axios recharts lucide-react react-hot-toast @vitejs/plugin-react
```

| Package | Purpose |
|---------|---------|
| `react-router-dom` | Client-side page routing |
| `axios` | HTTP client for API calls |
| `recharts` | Charts library (line, bar, pie) |
| `lucide-react` | Icon library |
| `react-hot-toast` | Toast notification popups |

### 3.3 Vite config (`vite.config.js`)
- Added API proxy: requests to `/api/*` are forwarded to `localhost:5000`
  **Why?** Avoids CORS issues during development.

### 3.4 Design System (`index.css`)
Created a comprehensive CSS design system with:
- CSS custom properties (variables) for colors, spacing, shadows
- Dark theme with glassmorphism effects
- Reusable classes: `.card`, `.btn`, `.badge`, `.data-table`, `.modal`, `.stat-card`
- Responsive grid system: `.grid-2`, `.grid-3`, `.grid-4`
- Animations: `fadeIn`, `slideUp`, `spin`

### 3.5 i18n Translations (`utils/translations.js`)
English and Hindi translations for all UI text.
**Usage:** `t('dashboard.title')` returns 'Dashboard' or 'डैशबोर्ड' based on language.

### 3.6 API Service Layer (`services/api.js`)
Centralized Axios instance with:
- Auto-attaches JWT token to every request
- Auto-redirects to login on 401 (unauthorized)
- Named export functions for every API endpoint

### 3.7 Auth Context (`contexts/AuthContext.jsx`)
React Context that provides:
- `user` — Current logged-in user data
- `login(email, password)` — Calls API and stores JWT
- `logout()` — Clears token and user data
- `hasRole('admin', 'safety_officer')` — Role checking
- `t('key')` — Translation function
- `switchLang('hi')` — Language switching

### 3.8 Frontend Pages
| Page | File | Description |
|------|------|-------------|
| Login | `pages/Login.jsx` | Glassmorphism card with animated orb background |
| Dashboard | `pages/Dashboard.jsx` | Stat cards + line/bar/pie charts + recent incidents |
| Incidents | `pages/Incidents.jsx` | Filterable table with pagination |
| New Incident | `pages/NewIncident.jsx` | Multi-step form (4 steps) |
| Incident Detail | `pages/IncidentDetail.jsx` | Full details + investigation editing + timeline |
| Inventory | `pages/Inventory.jsx` | First aid box cards with stock level progress bars |
| Employees | `pages/Employees.jsx` | Employee table + add employee modal |
| Departments | `pages/Departments.jsx` | Department cards with CRUD modal |
| Reports | `pages/Reports.jsx` | Tabbed: Compliance/Department/Accident Register |
| Settings | `pages/Settings.jsx` | Language toggle + password change |

### 3.9 App Router (`App.jsx`)
- `BrowserRouter` wraps the entire app
- `ProtectedRoute` component checks auth + role before rendering
- `AppLayout` renders Sidebar + Navbar + routed content
- Login page is outside the layout (full-screen)

### 3.10 Authentication Enhancements
- Added Google OAuth support via `google-auth-library` (Backend).
- Added Apple Sign-In support via `apple-signin-auth` (Backend).
- Created `/api/auth/signup` route for new user registration.
- Updated Login UI to support social login methods.

---

## STEP 4: Seed Data

### 4.1 Run seeder
```bash
cd server
npm run seed
```
Creates demo data:
- 1 Company (Demo Manufacturing Pvt Ltd)
- 8 Departments with risk levels
- 5 Users (one per role)
- 20 Prescribed first aid items (per Factories Act)
- 3 First aid boxes (adequately stocked)

### 4.2 Login Credentials
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@simplyaid.com | Admin@123 |
| Safety Officer | safety@simplyaid.com | Safety@123 |
| First Aider | firstaider@simplyaid.com | First@123 |
| Dept Head | depthead@simplyaid.com | Dept@123 |
| Employee | employee@simplyaid.com | Emp@123 |

---

## STEP 5: Running the App

### Prerequisites
- Node.js 18+ installed
- MongoDB running locally (or MongoDB Atlas URI)

### Start backend
```bash
cd server
npm run dev
```
Should see: `✅ MongoDB Connected` and `🚀 Server running on port 5000`

### Start frontend
```bash
cd client
npm run dev
```
Open `http://localhost:5173` in browser.

---

## Indian Compliance Features

| Requirement | Implementation |
|-------------|---------------|
| 1 FA box per 150 workers (Section 45) | Auto-calculated in compliance report |
| Certified person in-charge per box | `firstAidCertified` field on User model |
| Ambulance room if 500+ workers | Auto-flag on Company model |
| Prescribed box contents (Class A/B/C) | Pre-seeded inventory items with quantities |
| Accident reporting (Section 88) | Auto-detect: days lost ≥ 2 or fatal → reportable |
| Form 18 tracking | `form18Generated` field on Incident |
| Accident Register | Dedicated report tab with CSV export |

---

## STEP 7: Prescription Workflow (Doctor to Worker)
Implemented a workflow separating Admin (Doctor) and Employee (Worker) to prescribe and consume first aid items.

### 7.1 Prescription Model (`models/Prescription.js`)
- Tracks `worker`, `prescribedBy`, `item`, `prescribedQty`, `consumedQty`.
- Enforces status (`active`, `completed`).

### 7.2 API Controllers & Routes
- `POST /api/prescriptions` - Doctor creates a prescription.
- `GET /api/prescriptions` - Doctor views all, Worker views only their own.
- `PUT /api/prescriptions/:id/take` - Worker consumes `qty` units from a specific `FirstAidBox`. Inventory is deducted automatically, and `consumedQty` increases.

### 7.3 Frontend UI (`pages/Prescriptions.jsx`)
- **Doctor View:** "Add Prescription" button opens modal to assign items to workers.
- **Worker View:** List of their prescriptions with "Take Dose" button, restricting them to take only up to the `prescribedQty`.

---

## STEP 8: Virtual Vending Machine & Employee ID (Kiosk Mode)
Implemented a "Virtual Vending Machine" kiosk feature for testing medicine lock/unlock logic, alongside adding Employee ID support to signups.

### 8.1 Employee ID in Sign-up
- **Backend**: Updated `signup` in `authController.js` to accept `employeeId` and save it to the new `User` document.
- **Frontend**: Added an "Employee ID (Optional)" field to the Signup mode in `Login.jsx`. Updated `AuthContext.jsx` to pass `employeeId` during registration.

### 8.2 Vending Machine API
- **Backend Routes (`routes/vendingRoutes.js`)**:
  - `POST /api/vending/login`: Authenticates a worker based entirely on their `employeeId` to simulate a physical card swipe or keypad entry at the kiosk.
  - `POST /api/vending/dispense`: Dispenses the item, securely validating that the item is prescribed to the employee, checking quantity limits, and automatically deducting from a designated `FirstAidBox`.

### 8.3 Kiosk UI (`pages/VendingMachine.jsx`)
- **Route**: Accessible at `/vending`.
- **Login Screen**: A focused UI where the worker inputs their `Employee ID`.
- **Dispense Dashboard**: A grid displaying "slots" for prescribed items. If the user has active prescriptions, they can click "Dispense". The UI simulates unlocking and updating the database in real-time.

---

## STEP 9: Global 2-Role System (Admin vs Employee)
Simplified the entire app from 5 roles down to just **2 user types**: `admin` (Doctor/Manager) and `employee` (Worker).

### 9.1 Why
The original system had `admin`, `safety_officer`, `first_aider`, `department_head`, and `employee`. The user wanted a cleaner separation: Admin handles all management (prescriptions, inventory, reports, employees) and Employees can only view their own prescriptions, report incidents, and use the vending machine.

### 9.2 Backend Changes (8 files)
- **`models/User.js`**: Role enum reduced to `['admin', 'employee']`
- **5 Route files**: All `authorize('admin', 'safety_officer', ...)` calls simplified to `authorize('admin')`
- **`incidentController.js`**: Removed `department_head` scope filtering and `safety_officer` notification logic
- **`seeds/seedData.js`**: All non-admin users set to `employee`, credentials simplified to 2 logins

### 9.3 Frontend Changes (7 files)
- **`App.jsx`**: Route role guards simplified to `['admin']`
- **`Sidebar.jsx`**: Menu visibility simplified to `['admin']`
- **`Dashboard.jsx`**: Admin-only stat fetching simplified
- **`Employees.jsx`**: Role colors, filter dropdown, and add-employee form limited to 2 roles
- **`IncidentDetail.jsx`**: Edit button visibility simplified
- **`Prescriptions.jsx`**: Doctor check simplified to `hasRole('admin')`
- **`NewIncident.jsx`**: First aider filter simplified

### 9.4 Commands Run
```bash
# Re-seed with updated 2-role data
cd server && node seeds/seedData.js

# Verify build
cd client && npm run build
```

---

## STEP 10: Signup User Type & Incident Report Fix

### 10.1 User Type on Registration Page
- **Frontend (`Login.jsx`)**: Added a "User Type" dropdown to the signup form with two options: `Employee (Worker)` and `Admin (Doctor / Manager)`.
- **Frontend (`AuthContext.jsx`)**: Updated `signup()` to accept and pass the `role` parameter.
- **Backend (`authController.js`)**: Updated the `signup` endpoint to extract `role` from the request body and validate it against `['admin', 'employee']`.

### 10.2 Incident Report Department Fix
- **Root Cause**: The `NewIncident` page calls `getUsers()` to populate the "Treated By" dropdown. But `GET /api/users` was behind `authorize('admin')`, causing 403 for employees.
- **Fix (`userRoutes.js`)**: Removed `authorize('admin')` from `GET /` and `GET /:id` — all authenticated users can now read the user list. Write operations (PUT, DELETE) remain admin-only.

 
 - - - 
 
 # #   S T E P   1 1 :   E m p l o y e e   P r o f i l e s ,   Q R   C o d e s   &   S c a n   H i s t o r y 
 M e r g e d   c o l l a b o r a t o r   P R   # 2   a n d   r e s o l v e d   c o n f l i c t s   t o   m a i n t a i n   o u r   s t r i c t   2 - R o l e   S y s t e m   ( A d m i n   a n d   E m p l o y e e ) . 
 -   * * E m p l o y e e   P r o f i l e   &   D i g i t a l   I D   C a r d s : * *   E m p l o y e e s   n o w   h a v e   a u t o - g e n e r a t e d   I D   n u m b e r s   a n d   d i g i t a l   I D   c a r d s   w i t h   d y n a m i c   Q R   c o d e s . 
 -   * * Q R   I n t e g r a t i o n : * *   B u i l t   w i t h   \ q r c o d e . r e a c t \   o n   f r o n t e n d ,   a u t o - g e n e r a t e d   o n   s i g n u p   b a c k e n d . 
 -   * * S c a n   H i s t o r y : * *   A d m i n s   c a n   v i e w   s c a n   h i s t o r y   f o r   p h y s i c a l   I D   u s a g e s . 
 -   * * C o n f l i c t   R e s o l u t i o n : * *   I n t e g r a t e d   t h e   n e w   f r o n t e n d   r o u t e s   ( \ / e m p l o y e e s / : i d / c a r d \ ,   \ / s c a n - h i s t o r y \ )   a n d   b a c k e n d   e n d p o i n t s   ( \ / a p i / e m p l o y e e s \ )   w h i l e   e x p l i c i t l y   s t r i p p i n g   o u t   o l d   r o l e s   ( s a f e t y _ o f f i c e r ,   f i r s t _ a i d e r )   t o   e n f o r c e   o u r   S t e p   9   c l e a n u p .  
 
 
 - - - 
 
 - - - 
 
 # #   S T E P   1 1 :   E m p l o y e e   P r o f i l e s ,   Q R   C o d e s   &   S c a n   H i s t o r y 
 M e r g e d   c o l l a b o r a t o r   P R   # 2   a n d   r e s o l v e d   c o n f l i c t s   t o   m a i n t a i n   o u r   s t r i c t   2 - R o l e   S y s t e m   ( A d m i n   a n d   E m p l o y e e ) . 
 -   * * E m p l o y e e   P r o f i l e   &   D i g i t a l   I D   C a r d s : * *   E m p l o y e e s   n o w   h a v e   a u t o - g e n e r a t e d   I D   n u m b e r s   a n d   d i g i t a l   I D   c a r d s   w i t h   d y n a m i c   Q R   c o d e s . 
 -   * * Q R   I n t e g r a t i o n : * *   B u i l t   w i t h   \ q r c o d e . r e a c t \   o n   f r o n t e n d ,   a u t o - g e n e r a t e d   o n   s i g n u p   b a c k e n d . 
 -   * * S c a n   H i s t o r y : * *   A d m i n s   c a n   v i e w   s c a n   h i s t o r y   f o r   p h y s i c a l   I D   u s a g e s . 
 -   * * C o n f l i c t   R e s o l u t i o n : * *   I n t e g r a t e d   t h e   n e w   f r o n t e n d   r o u t e s   ( \ / e m p l o y e e s / : i d / c a r d \ ,   \ / s c a n - h i s t o r y \ )   a n d   b a c k e n d   e n d p o i n t s   ( \ / a p i / e m p l o y e e s \ )   w h i l e   e x p l i c i t l y   s t r i p p i n g   o u t   o l d   r o l e s   ( s a f e t y _ o f f i c e r ,   f i r s t _ a i d e r )   t o   e n f o r c e   o u r   S t e p   9   c l e a n u p .  
 
 
 - - - 
 
 # #   S T E P   1 2 :   C o m p l i a n c e   A n a l y t i c s   S u i t e 
 M e r g e d   c o l l a b o r a t o r   P R   # 3   ( C o m p l i a n c e   A n a l y t i c s   S u i t e )   w h i l e   p r e s e r v i n g   t h e   c o r e   P r e s c r i p t i o n   m o d e l s   r e q u i r e d   f o r   V i r t u a l   V e n d i n g   M a c h i n e   i n t e g r a t i o n . 
 -   * * F e a t u r e s   A d d e d : * *   C o m p l i a n c e   D a s h b o a r d ,   S a f e t y   A n a l y t i c s ,   E x p i r y   t r a c k i n g ,   A I   A s s i s t a n t ,   a n d   M e d i c a l   T r e a t m e n t s   l o g g i n g . 
 -   * * C o n f l i c t   R e s o l u t i o n : * *   A d d r e s s e d   s e v e r e   a r c h i t e c t u r a l   d i v e r g e n c e   i n   t h e   \ P r e s c r i p t i o n \   e n t i t y   b y   e x p l i c i t l y   r e j e c t i n g   t h e   P R   # 3   s t a n d a l o n e   t e x t - b a s e d   p r e s c r i p t i o n s   i n   f a v o r   o f   o u r   S t e p   7   i n v e n t o r y - l i n k e d   p r e s c r i p t i o n s ,   e n s u r i n g   t h e   V i r t u a l   V e n d i n g   M a c h i n e   c o n t i n u e s   t o   f u n c t i o n . 
 -   * * R o l e   R e s t r i c t i o n s : * *   M a i n t a i n e d   s t r i c t   a d h e r e n c e   t o   t h e   2 - r o l e   s y s t e m   ( A d m i n   a n d   E m p l o y e e )   b y   r e s t r i c t i n g   n e w   d a s h b o a r d s   t o   A d m i n s   o n l y .  

## STEP 13: Dashboard and Scanner Flow Updates
- **Manager Dashboard Refactoring:** Added a statistics row, split the interface into 'Pending Actions' and 'History' tabs, and scoped all data strictly to the manager's assigned department.
- **Doctor Dashboard Restrictions:** Restricted the "Awaiting Review" section to strictly pull incidents explicitly forwarded by the manager (`forwardedToDoctor` flag).
- **Global Scanner Context Syncing:** Implemented a system where selecting a scanner from the global Navbar automatically filters the Inventory and Incidents pages to match the scanner's exact location.
- **QR Scan Flow Restored:** Ensured the choice modal (Full Report vs Pending Alert to Manager) appears for all scan types (self-scan or employee-scan), providing maximum flexibility.