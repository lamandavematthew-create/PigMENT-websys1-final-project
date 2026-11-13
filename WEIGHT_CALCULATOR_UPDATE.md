# Floating Weight & Price Calculator

The existing calculator opens over Home and My Pigs. It retains the original fields, measurement guide, live estimates, and calculation formula. Reset clears the inputs. Done, the close icon, Escape, or a backdrop click closes the dialog without leaving the page. Direct links still open the standalone calculator.

## Updating an existing installation

Copy these files into the matching paths:
- `src/index.html`
- `src/pages/my-pigs.html`
- `src/pages/weight-calculator.html`
- `src/js/weight-calculator.js`
- `src/css/weight-calculator-dialog.css`

Keep the live `database/db.php`. The floating calculator needs no database change. If deploying the Registered Pigs price feature for the first time as part of the full project, first check whether the live `pigs.price_per_kg` column exists. If missing, apply `database/migrations/002_pig_price_per_kg.sql` as described in `REGISTERED_PIGS_UPDATE.md`.
