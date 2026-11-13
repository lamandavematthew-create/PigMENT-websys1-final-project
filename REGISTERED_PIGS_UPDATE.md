# Registered Pigs layout and price update

The Registered Pigs card follows the provided prototype. The pig image is a generic illustration. Price per kilogram is an optional, saved value on each record. Estimated value uses that price multiplied by the latest recorded weight estimate. Neither number is taken from the mockup or the marketplace. Existing pigs have no price until one is entered.

## Installing on an existing PigMENT deployment

1. Back up the existing database and files.
2. In phpMyAdmin select your existing PigMENT database and run `database/migrations/002_pig_price_per_kg.sql` once. It adds one nullable column and does not replace the database or existing pig records. If your database already has a compatible `pigs.price_per_kg` column, skip this step.
3. Copy only these paths into the same locations in your deployment.
   - `api/pigs.php`
   - `src/pages/my-pigs.html`
   - `src/js/my-pigs.js`
   - `src/css/registered-pigs-price.css`
   - `public/assets/registered-pigs-price/`
4. Keep your existing `database/db.php` and server settings. This update does not require changing them.

## Quick check

Open My Pigs → Registered Pigs → View Details. Beside or below Record Weight, enter the optional price and select Save Price. This does not add a weight measurement. Use Edit Pig for other record fields. Check that the price remains after refreshing. At ₱180/kg and a latest estimate of 78.5 kg, the card should show ₱14,130. Without a price or weight the total is unavailable. Clear the price field and select Save Price to remove it. Moving the field does not require a new migration if the price column already exists.
