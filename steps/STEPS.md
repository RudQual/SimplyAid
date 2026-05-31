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
