# STEPS 19 — Department Boxes, Scanner Locations & Doctor Inventory Edit

## What Was Built
1. **22 First Aid Boxes** across all 8 departments (was only 4 boxes in 4 departments)
2. **20 Scanners** with locations in the navbar scanner dropdown (grouped by department)
3. **780 stock batches** with varied expiry dates for testing the Expiry Dashboard
4. **Doctor Inventory Edit** — "Manage Items" button + inline quick-edit quantities on Inventory page

---

## Step 1: Expand Seed Data (22 Boxes)

### File: `server/seeds/seedData.js`

**What changed:** Replaced the 4-box creation section with 22 boxes covering all 8 departments:

| Department | Boxes | Class Types | Risk |
|-----------|-------|-------------|------|
| Production | 3 (FAB-PROD-001 to 003) | B, B, C | High |
| Maintenance | 3 (FAB-MAINT-001 to 003) | B, B, A | High |
| Quality Control | 2 (FAB-QC-001 to 002) | B, A | Medium |
| Stores & Warehouse | 3 (FAB-STORE-001 to 003) | B, C, B | Medium |
| Administration | 2 (FAB-ADMIN-001 to 002) | A, A | Low |
| Safety & EHS | 2 (FAB-SAFETY-001 to 002) | B, C | Low |
| Human Resources | 2 (FAB-HR-001 to 002) | A, A | Low |
| Logistics | 3 (FAB-LOG-001 to 003) | B, B, A | Medium |

**Key code change:** Added a helper function `makeBoxItems(cls)` to generate items for any class type (A/B/C):
```javascript
const makeBoxItems = (cls) => items.map(item => ({
  item: item._id,
  currentQty: item.requiredQty[`class${cls}`],
  requiredQty: item.requiredQty[`class${cls}`]
}));
```

---

## Step 2: Run Scanner Seeds

### Command:
```bash
node server/seeds/seedScanners.js
```

This created 20 scanners across all 8 departments (2-3 per department). These show up in the **Scanner dropdown** in the top navbar, grouped by department name.

**Note:** If you get a duplicate key error, drop the scanners collection first:
```bash
cd server
node -e "require('dotenv').config(); const mongoose = require('mongoose'); mongoose.connect(process.env.MONGO_URI).then(async()=>{ await mongoose.connection.db.collection('scanners').drop().catch(()=>{}); console.log('Done'); process.exit(0); })"
```

---

## Step 3: Run Stock Seed (Expiry Data)

### Command:
```bash
node server/seeds/seedBoxStocks.js
```

This added 780 stock batches across all 20 boxes with varied expiry profiles:
- 🔴 Expired items (past dates)
- 🟠 Critical items (7 days)
- 🟡 Warning items (30 days)
- 🔵 Upcoming items (90 days)
- 🟢 Healthy items (90+ days)

This data populates the **Expiry Dashboard** (`/expiry`).

---

## Step 4: Doctor Inventory Edit (Frontend)

### File: `client/src/pages/Inventory.jsx`

**Changes made:**

### A) "Manage Items" Button
Added a primary button on each box card:
```jsx
<button className="btn btn-primary btn-sm" onClick={() => navigate(`/inventory/boxes/scan/${box.boxId}`)}>
  <Edit2 size={14} /> Manage Items
</button>
```
This navigates to the **BoxProfile page** where the doctor can:
- View all items with quantities and expiry
- Click "Edit" on any item to open a **stocks management modal**
- Add new batch entries (with batch number, quantity, expiry date, supplier)
- Remove old batches
- Save changes

### B) Expiry Badges in Expanded View
Each item in the expanded box view now shows an expiry badge:
```jsx
const getExpiryInfo = (item) => {
  // Finds nearest expiry from stocks
  // Returns { label: 'Expired' | '5d left' | 'OK', color: 'red' | 'amber' | 'green' }
};
```

### C) Inline Quick-Edit Quantity
When the doctor clicks the pencil icon next to a quantity:
- A +/- stepper appears with a save button
- Doctor can quickly update the quantity
- Under the hood, it updates the first stock batch quantity
- Uses the existing `updateBoxItemStocks` API

---

## Step 5: Git Commit

```bash
cd C:\Users\rpsru\Desktop\SimplyAID
git add -A
git commit -m "feat: add 22 boxes across 8 depts, scanner locations, expiry data, doctor inventory edit"
```

---

## How to Test

1. **Login as Doctor:** `arun@simplyaid.com` / `Demo@123`
2. **Scanner dropdown (top navbar):** Should show all 8 departments with 2-3 scanners each
3. **Inventory page (`/inventory`):**
   - 22 boxes visible (or filtered by scanner department)
   - "Manage Items" button → goes to BoxProfile with full stock editing
   - Expand a box → see items with expiry badges + click pencil to quick-edit qty
4. **Expiry Tracking (`/expiry`):** Shows items with expired/critical/warning/healthy statuses

---

## Files Changed

| File | What Changed |
|------|-------------|
| `server/seeds/seedData.js` | 4 → 22 boxes, `makeBoxItems()` helper, all 8 departments |
| `client/src/pages/Inventory.jsx` | "Manage Items" button, expiry badges, inline quick-edit |
