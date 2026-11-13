# My Pigs mobile layout fix

The Registered Pigs toolbar was inheriting a vertical flex layout on phones while its controls still had desktop flex basis values. Those values became vertical space. The mobile toolbar now uses a compact grid with 44 px controls. Search and status sit side by side when space permits and stack on smaller phones.

To update the previous Profile Refresh package, copy:
- `src/pages/my-pigs.html`
- `src/css/registered-pigs-price.css`

This fix does not change filtering logic, APIs, or the database. Keep your existing live `database/db.php`. If deploying the older Registered Pigs price feature for the first time as part of the full project, check for `pigs.price_per_kg` and run `database/migrations/002_pig_price_per_kg.sql` only if missing.
