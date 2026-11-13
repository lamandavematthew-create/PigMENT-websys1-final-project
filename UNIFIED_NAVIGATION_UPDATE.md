# Unified farmer navigation

Start at `src/index.html`. It renders Home, My Pigs, Marketplace, Pig Health, Summary, and Profile inside one document. Section links use fragments such as `index.html#my-pigs`, so direct links, refreshes, and browser history can identify the section. The former farmer HTML pages redirect to the matching section, including older Register a Pig and Manage Pig Pens bookmarks.

## Install

Use the full package, or copy the files listed below from this package over the immediately previous Mobile Navigation Fix release.

- `src/index.html`
- `src/css/workspace.css`
- `src/js/workspace.js` and `src/js/workspace-redirect.js`
- `src/js/auth.js`, `src/js/disease-map.js`, `src/js/my-pigs.js`, `src/js/marketplace.js`, `src/js/reports.js`, and `src/js/profile.js`
- `src/pages/my-pigs.html`, `src/pages/marketplace.html`, `src/pages/reports.html`, `src/pages/profile.html`, `src/pages/login.html`, and `src/pages/register.html`

Preserve the live `database/db.php`. This navigation update has no database migration. When deploying older features in the full package for the first time, check any migrations that your live database has not received, including the Registered Pigs price column `pigs.price_per_kg`.

Login, registration, and the administrator pages remain separate. To check the update on localhost, sign in, click all six sidebar links, and try browser Back and Refresh. Also check the Register a Pig and Manage Pig Pens shortcuts and the Pig Health My Reports link.
