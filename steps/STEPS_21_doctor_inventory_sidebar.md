# Step 21: Add Inventory Option to Sidebar for Doctor Account

## Goal
Add the "Inventory" option to the sidebar exclusively for the Doctor account, and simplify the Inventory page view so that doctors only see the quantity update feature for each box, and nothing else (such as inspections or managing items).

## Changes Made
1. **Sidebar Updates (`client/src/components/common/Sidebar.jsx`)**:
   - Added the `Inventory` path (`/inventory`) to the `menuItems` array under the "Doctor-specific" section with the roles set to `['doctor']`.

2. **Inventory Page Simplification (`client/src/pages/Inventory.jsx`)**:
   - Removed the "Next inspection due" line from the box details to keep the view clean for doctors.
   - Completely removed the "Action Buttons" section (which included "Manage Items" and "Log Inspection" functionality) from the box card.
   - The expanded items view still functions as expected, allowing doctors to use the quick inline edit tools to update the quantity for each item (the `editQty` functionality using the `+` and `-` buttons with the quick save feature).

## Result
When a user logs in with the doctor role, they will now see the `Inventory` menu item in their sidebar. Visiting the inventory page will list the boxes but strip away any extraneous action elements, leaving only the ability to view the list of items in the box and update their respective quantities.
