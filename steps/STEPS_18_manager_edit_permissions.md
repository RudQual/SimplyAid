# Step 18: Full Edit Permissions for Managers/Doctors

**Goal:** Provide "complete edit permission" on incident reports for managers (and doctors), allowing them to update the outcome directly from the edit view and properly triggering the notification flow if "Send to Doctor" or "Back to Work" is selected during an edit.

## 1. Frontend Updates

### `client/src/pages/IncidentDetail.jsx`
- Replaced the inline partial edit form (which only edited status, root cause, etc.) with a full-page edit view.
- When `editing` is true, a comprehensive form is displayed containing:
  - **Status** (Reported, Under Investigation, Resolved, Closed)
  - **Outcome** (Pending Confirmation, Returned to Work, Sent Home, Hospitalized, Referred to Doctor, Under Observation)
  - **Severity** (Minor, Moderate, Serious, Fatal)
  - **Days Lost**, **Location**, **Description**, **Treatment Given**
  - **Investigation Details** (Root Cause, Corrective Action, Preventive Measures)
- This gives managers and doctors full control to rectify or update any detail of the incident report.

## 2. Backend Updates

### `server/controllers/incidentController.js`
- **Updated `updateIncident`:** 
  - Added detection for when the `outcome` field is explicitly changed during an edit.
  - If the new outcome is `referred_to_doctor`, the system now automatically sets `forwardedToDoctor = true` and pushes a `warning` notification to all doctors in the company, just like the `managerConfirm` flow does.
  - If the new outcome is `returned_to_work`, the system automatically sets `forwardedToDoctor = false` and resolves the incident if it wasn't already resolved or closed, preventing it from getting stuck in an active state.
