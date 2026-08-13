# First Aid Incident Step & UI Fixes

In this step, we introduced several key enhancements to the Incident Reporting flow, fixed bugs, and tweaked the UI navigation.

## 1. Global QR Scanner
- **Objective:** Move the QR scanner from the sidebar (where it was duplicated per role) into a globally accessible navbar location.
- **Code Change:**
  - Removed `<ScanLine>` menu items from `Sidebar.jsx`.
  - Added a global QR Code scanner button in `Navbar.jsx` near the SOS button and Location dropdown.

## 2. Bug Fixes & Autofill Improvements
- **Missing Icon Crash:** Fixed a white-screen crash in `NewIncident.jsx` by properly importing the `Clock` icon from `lucide-react`.
- **Autofill Backend Rejection:** The autofill function in `NewIncident.jsx` was submitting `outcome: 'referred_to_hospital'`, which didn't match the MongoDB Enum (which expected `hospitalized` or `referred_to_doctor`). We corrected this to `referred_to_doctor`.
- **Pending Manager Confirmation:** We restored the "Pending Manager Confirmation" button in the Outcome step of the `NewIncident.jsx` form so workers can send reports to their managers for approval.

## 3. First Aid / Medicine Step Integration
- **Objective:** Allow an employee to document if they used medicine/supplies from a First Aid Box during the incident report, and automatically deduct that stock upon manager approval.
- **Frontend Changes (`NewIncident.jsx`):**
  - Updated `STEPS` array to include a new Step 2: "First Aid / Medicine".
  - Imported `getBoxes` and `getInventoryItems` from the API and fetched them in a `useEffect`.
  - Added `usedFirstAid` (boolean), `firstAidBoxUsed` (dropdown selection), and `itemsUsed` (array of objects with item, itemName, quantity) to the component's state.
  - Implemented the UI to toggle First Aid usage and dynamically add items.
  - Updated `canNext()` validation to ensure a box is selected if the user claims to have used First Aid items.
  - Updated the "Magic Wand" autofill script to use state spreading `setForm(f => ({ ...f, ...new_data }))` so it doesn't wipe out the First Aid states.
  - Updated `handleSubmit` to clean up first aid fields if the checkbox was turned off before submission.

- **Backend Changes (`incidentController.js`):**
  - Updated the `managerConfirm` endpoint. Previously, stock deductions only happened when a Doctor reviewed the incident. We copied the exact stock deduction logic (FIFO by expiry date) into the `managerConfirm` controller function. 
  - Now, the second a manager confirms an on-site incident, the items used are instantly depleted from the database.

## 4. Database Seeding for Presentation
- **Objective:** The inventory database was empty, so we needed to re-seed it to show off the deduction logic.
- **Action:** Ran the existing backend scripts:
  - `npm run seed` (runs `seedData.js`)
  - `node seeds/seedBoxesForScanners.js`
  - `node seeds/seedBoxStocks.js`
- This populated the database with 22 boxes and 780 fresh stock batches.

## 5. Doctor Sidebar Cleanup
- **Objective:** Remove non-relevant tools from the Doctor's sidebar.
- **Code Change:**
  - Removed `Inventory`, `Compliance`, and `Analytics` from the `roles: ['doctor']` section in `Sidebar.jsx`.

## Git Commits
All changes have been committed locally.
