# Marketplace refresh

Marketplace now uses the same navigation shell and illustrated banner assets as Home and My Pigs. Browse Listings and My Listings appear above search. Desktop filters remain visible, while mobile users can expand them with the Filters button. Listing cards use existing listing photos, prices, and metadata. No sample listings were added.

## Update an existing installation

If it already has the Home refresh, copy:
- `src/pages/marketplace.html`
- `src/css/marketplace-refresh.css`
- `src/js/marketplace.js`

The page uses `src/css/home-refresh.css` and the existing `public/assets/home-redesign/` assets. Keep your live `database/db.php`. This Marketplace update has no database migration. If also rolling out the older Registered Pigs price feature for the first time, check whether the live `pigs.price_per_kg` column exists and apply `database/migrations/002_pig_price_per_kg.sql` only if needed.
