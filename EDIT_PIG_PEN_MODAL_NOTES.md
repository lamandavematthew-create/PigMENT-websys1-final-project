# Edit Pig Pen modal update

- Reused the existing pen form and PHP API handlers. No database changes.
- Both **Edit Pen** and **Create Pig Pen** open in a responsive centered dialog with a dimmed backdrop, Escape-key support, keyboard focus containment, close/cancel buttons, and focus return.
- Existing fields remain: name, type, status, capacity, and description.
- Duplicate-name and server validation errors are displayed inside the dialog; successful changes are refreshed and shown on the page.
- Updated files: `src/pages/my-pigs.html`, `src/js/my-pigs.js`, and new `src/css/edit-pen-modal.css`.
- Requires XAMPP testing for successful create/edit, duplicate name validation, Escape/Cancel, mobile sizing, and data refresh.
