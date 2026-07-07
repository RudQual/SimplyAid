# Step 17: Pending Outcome / Manager Confirmation Flow

**Goal:** Allow workers reporting incidents to defer the outcome decision ("Back to Work" vs "Send to Doctor") to a manager.

## 1. Backend Updates

### `server/models/Incident.js`
- Added `'pending_confirmation'` to the `outcome` field's enum list. This ensures the database can store this new state.

### `server/controllers/incidentController.js`
- **Updated `getIncidents`:** Added `outcome` to the query parameter filters so the frontend can specifically ask for incidents awaiting confirmation.
- **Updated `managerConfirm`:** 
  - Modified the endpoint to accept a new `outcome` field from the request body.
  - If the manager chooses `referred_to_doctor`, we set `forwardedToDoctor = true` and push a notification to the doctors.
  - If the manager chooses `returned_to_work`, we resolve the incident directly without involving the doctor.

## 2. Frontend Updates

### `client/src/pages/NewIncident.jsx`
- In Step 2 (Outcome selection), we added a third option card: **"Pending Manager Confirmation"**.
- Added an orange `Clock` icon to represent this pending state.
- When selected, a small informational banner appears below it explaining that the manager will be notified to make the final decision on-site.

### `client/src/pages/ManagerDashboard.jsx`
- Added a second query fetch to load incidents specifically where `outcome === 'pending_confirmation'`.
- Created a new UI section between "Manager Assist" and "Normal Pending" called **"Awaiting Your Outcome Decision"**.
- Added two specific action buttons for these pending incidents: **Back to Work** and **Send to Doctor**.
- Updated the existing confirmation modal to adapt its title and description based on which of those two buttons was clicked, providing clear context of what the manager is confirming.
- Submitting the modal now passes the selected outcome back to the `managerConfirmIncident` API endpoint.
