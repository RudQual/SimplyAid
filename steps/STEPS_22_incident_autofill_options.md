# Step 22: Add More Autofill Entries in Incident Report

## Goal
Expand the autofill functionality in the Incident Report form so that instead of returning a single predefined incident scenario every time, it randomly selects from a variety of distinct incident scenarios.

## Changes Made
1. **Updated Autofill Logic (`client/src/pages/NewIncident.jsx`)**:
   - Replaced the hardcoded single-scenario `handleAutofill` state update with a new `scenarios` array containing 4 different incident scenarios:
     - Rajesh Kumar (Machine Operator): Slip and Fall with a fracture and laceration.
     - Priya Singh (Quality Inspector): Machine pinch point causing a minor cut/crush injury.
     - Anil Desai (Chemical Handler): Chemical splash bypassing goggles causing eye/face injury.
     - Meera Reddy (Warehouse Associate): Falling object resulting in a sprain.
   - Updated the click handler to select a random element from the `scenarios` array using `Math.random()`.
   - Maintained dynamic assignments (like current date/time and available default departments) for the chosen scenario.

## Result
When the user clicks the "Autofill Demo Incident" button (magic wand icon), the form is now populated with a random scenario, providing more variety for testing and demonstrations.
