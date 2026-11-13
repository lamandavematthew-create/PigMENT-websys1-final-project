# Mobile navigation fix

The sticky top bar previously covered the top of the mobile sidebar, hiding the PigMENT logo and name. On screens up to 800 px, the drawer now opens below the top bar. The hamburger, notification icon, account avatar, and Log out remain accessible. The drawer scrolls independently on short screens. Desktop navigation is unchanged.

For an existing installation, copy `src/css/home-refresh.css` and the updated stylesheet references in `src/index.html`, `src/pages/my-pigs.html`, `src/pages/marketplace.html`, `src/pages/reports.html`, and `src/pages/profile.html`. No database change is needed for this fix. Keep your existing live `database/db.php`.
