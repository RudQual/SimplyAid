# Step 14: Fix Missing prescriptionRoutes.js (Server Crash)

## Problem
The server crashed immediately on startup with:
```
Error: Cannot find module './routes/prescriptionRoutes'
```
**Root Cause:** `server.js` line 46 has `require('./routes/prescriptionRoutes')` but the
file `server/routes/prescriptionRoutes.js` was never created. It was likely deleted or
lost during the Step 13 role overhaul / merge conflict resolution.

## What Was Done

### 1. Created `server/routes/prescriptionRoutes.js`
- Added a **stub route file** with placeholder endpoints so the server can start.
- All routes are behind `protect` (JWT auth) and `authorize('doctor')` (doctor-only).
- Endpoints return placeholder JSON responses (empty arrays, 501 Not Implemented, etc.).
- This is a **temporary fix** — full prescription CRUD logic should be added later.

### Routes Created
| Method | Path | Response |
|--------|------|----------|
| GET | `/api/prescriptions` | `{ success: true, data: [] }` |
| GET | `/api/prescriptions/:id` | 404 Not Found |
| POST | `/api/prescriptions` | 501 Not Implemented |
| PUT | `/api/prescriptions/:id` | 501 Not Implemented |
| DELETE | `/api/prescriptions/:id` | 501 Not Implemented |

## Commands Used
```bash
# After creating the file, nodemon auto-restarts the server
# Git commit
git add server/routes/prescriptionRoutes.js
git commit -m "fix: add missing prescriptionRoutes.js to fix server crash on startup"
```

## How to Verify
1. Check the terminal running `npm run dev` in the `server/` folder
2. Server should now start without `MODULE_NOT_FOUND` error
3. You should see: `🚀 SimplyAID Server running on port 5000`
