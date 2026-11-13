# Profile refresh

Profile uses the same sidebar, top bar, and farm hero assets as Farm Summary. The active navigation item is Profile. The page displays the signed-in farmer's name, initials, contact information, farm location, and read-only account email and role. The existing profile endpoint handles edits.

To update the previous Farm Summary package, copy `src/pages/profile.html`, `src/js/profile.js`, and `src/css/profile-refresh.css`. Keep the shared Home stylesheet and assets. Keep the live `database/db.php`. No database migration is needed for this Profile update. If introducing the older Registered Pigs price feature for the first time, check for `pigs.price_per_kg` and apply the included migration only if missing.
