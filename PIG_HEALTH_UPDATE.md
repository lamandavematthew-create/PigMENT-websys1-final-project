# Pig Health refresh

Pig Health reuses the Home banner and navigation. The Disease Awareness Map opens first, with separate Health Guide and My Reports sections. The reporting form opens in a dialog. Only its location picker displays the draft pin. The public map still loads published records from the existing API. On successful submission, the dialog closes and My Reports opens.

## Install on an existing copy

Copy `src/index.html`, `src/js/disease-map.js`, and `src/css/pig-health-refresh.css`. The banner uses the existing Home refresh stylesheet and assets. Keep your live `database/db.php`. This Pig Health update does not require a database migration. If the full ZIP also introduces the earlier Registered Pigs price feature to your live site, first check for `pigs.price_per_kg` and run `database/migrations/002_pig_price_per_kg.sql` only if it is missing.

## Check in your browser

Open Pig Health, test all three sections, change and reset the map filters, and open Report an Illness. Test the picker and report flow using a local or test account. Verify the report appears in My Reports but not on the public map while pending. On a phone, the form and picker should stack vertically.
