# STEPS 16 — Multi-Feature Enhancement

This step covers 4 major features built together:
1. **Enhanced Incident Report** — Multiple injury types, scanner-based location, department tree notifications
2. **Remove Treatment from Incident Form** — Doctor adds treatment later
3. **Global Scanner Selector** — Navbar dropdown instead of sidebar menu
4. **Multiple Stocks & Persistent Expiry Tracking** — Stock batches per item, global timer

---

## Feature 1: Scanner Model + Multiple Injuries

### Backend
1. Created `server/models/Scanner.js` — new model with fields: `scannerId`, `name`, `department` (ref), `location`, `floor`, `company` (ref), `isActive`
2. Created `server/controllers/scannerController.js` — CRUD operations (get, create, update, soft-delete)
3. Created `server/routes/scannerRoutes.js` — RESTful routes with auth protection
4. Registered routes in `server/server.js`: `app.use('/api/scanners', require('./routes/scannerRoutes'))`
5. Updated `server/models/Incident.js`:
   - Added `scanner` field (ObjectId ref to Scanner)
   - Added `injuryTypes` array: `[{ type: String, severity: String }]`
   - Made `incidentType` optional with default `'injury'`
6. Updated `server/controllers/incidentController.js`:
   - `createIncident` now auto-resolves department/location from scanner
   - Notifications follow department tree: dept managers → dept workers
7. Created seed script `server/seeds/seedScanners.js` — gives 2-3 scanners per department
8. Ran: `node server/seeds/seedScanners.js` → created 20 scanners across 8 departments

### Frontend
9. Added `getScanners()` to `client/src/services/api.js`

---

## Feature 2: Remove Treatment Step

### What Changed
- `NewIncident.jsx` steps changed from `['Injured Person', 'Incident Details', 'Treatment', 'Outcome']` to `['Injured Person', 'Incident Details', 'Outcome']`
- Removed all treatment fields from the incident form: `treatmentGiven`, `treatedBy`, `firstAidBoxUsed`
- Treatment will be added by the doctor later through the Doctor Dashboard

### Outcome Step Simplified
- Only 2 options now: "Send to Doctor" or "Back to Work"
- Big radio-card style buttons instead of a dropdown

---

## Feature 3: Global Scanner Selector in Navbar

### Frontend
1. Created `client/src/contexts/ScannerContext.jsx`:
   - Stores `selectedScanner` in state + `localStorage`
   - Provides `scanners`, `selectedScanner`, `setSelectedScanner`, `scannersByDepartment`, `loadScanners`
2. Updated `client/src/App.jsx` — wrapped app with `<ScannerProvider>`
3. Updated `client/src/components/common/Navbar.jsx`:
   - Added scanner selector dropdown between language toggle and SOS button
   - Shows scanners grouped by department
   - Displays scanner name + location
   - Has "Clear" button to deselect
4. Updated `client/src/components/common/Navbar.css` — added all scanner dropdown styles
5. Updated `client/src/components/common/Sidebar.jsx` — removed QR Scanner link (scanner is now global in navbar)
6. Updated `client/src/pages/NewIncident.jsx`:
   - Uses `useScanner()` to get selected scanner
   - Auto-fills `location` and `department` from scanner
   - Shows scanner info bar at top of form
   - Shows warning if no scanner selected
7. Updated `client/src/pages/QrScan.jsx`:
   - Uses `useScanner()` for auto-location in self-report and delegate flows

---

## Feature 4: Multiple Stocks & Persistent Expiry

### Backend
1. Updated `server/models/FirstAidBox.js`:
   - Added `stockEntrySchema`: `{ batchNumber, quantity, expiryDate, manufacturingDate, supplier, purchaseDate, addedAt }`
   - Added `stocks: [stockEntrySchema]` to `boxItemSchema`
   - Kept legacy single-entry fields for backward compatibility
   - Updated `computeStatus()` — uses stocks sum or legacy currentQty
   - Updated `getExpiryStatus()` — iterates over individual stock batches
2. Created `server/models/ExpirySchedule.js` — stores `{ key, lastRunAt, intervalHours, alertsGeneratedLastRun, boxesCheckedLastRun }`
3. Created `server/utils/expiryScheduler.js`:
   - Checks every hour if it's time to run (every 24h by default)
   - Persists last run time to DB via ExpirySchedule model
   - Runs across all companies
   - Reuses alert threshold logic
4. Updated `server/server.js` — imports and starts scheduler: `startExpiryScheduler()`
5. Rewrote `server/controllers/expiryController.js`:
   - Helper `getExpiryEntries()` works with both stocks[] and legacy fields
   - Dashboard, items list, and alert generation all iterate over stock entries

### Frontend
6. Rewrote `client/src/pages/ExpiryDashboard.jsx`:
   - Groups items by itemName + boxId
   - Shows total stock quantity and nearest expiry at group level
   - Expandable rows to see individual batch details (batch number, supplier, quantity, expiry)

---

## Files Created
- `server/models/Scanner.js`
- `server/models/ExpirySchedule.js`
- `server/controllers/scannerController.js`
- `server/routes/scannerRoutes.js`
- `server/utils/expiryScheduler.js`
- `server/seeds/seedScanners.js`
- `client/src/contexts/ScannerContext.jsx`

## Files Modified
- `server/models/Incident.js` — added injuryTypes[], scanner ref
- `server/models/FirstAidBox.js` — added stocks[] sub-array
- `server/controllers/incidentController.js` — scanner auto-resolve, tree notifications
- `server/controllers/expiryController.js` — stocks-aware aggregation
- `server/server.js` — scanner routes, expiry scheduler
- `client/src/services/api.js` — getScanners()
- `client/src/App.jsx` — ScannerProvider wrapper
- `client/src/components/common/Navbar.jsx` — scanner selector dropdown
- `client/src/components/common/Navbar.css` — scanner styles
- `client/src/components/common/Sidebar.jsx` — removed QR Scanner link
- `client/src/pages/NewIncident.jsx` — 3 steps, multi-injury, scanner location
- `client/src/pages/ExpiryDashboard.jsx` — stock-level view
- `client/src/pages/QrScan.jsx` — scanner context integration

## Commands Run
```bash
node server/seeds/seedScanners.js
```
