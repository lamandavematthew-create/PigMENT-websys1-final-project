# Farm Summary refresh

The farmer navigation label is now Summary and the print action is Print Summary. The URL remains `src/pages/reports.html` so existing bookmarks still work. Pig Health → My Reports and administrator disease reports keep their names and behavior.

Farm Summary uses the existing authenticated data sources and Home artwork. Pen occupancy bars are calculated from active assignments and configured capacity. The growth table uses saved estimates. No sample data or database changes were added.

## Update an existing installation

From the immediately previous Pig Health package, copy these changed files:
- `src/pages/reports.html`
- `src/css/farm-summary.css`
- `src/js/reports.js`
- `src/index.html`
- `src/pages/my-pigs.html`
- `src/pages/marketplace.html`
- `src/pages/profile.html`

Keep the live `database/db.php`. Farm Summary requires no new migration. If this upload also introduces the previous Registered Pigs price feature, confirm the live `pigs.price_per_kg` column exists and add it with `database/migrations/002_pig_price_per_kg.sql` only if missing.
