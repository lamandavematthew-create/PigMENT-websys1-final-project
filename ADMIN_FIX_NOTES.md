# PigMENT admin functionality fixes

- Restored missing (empty) `src/pages/admin-dashboard.html` as a working HTML admin home page.
- Overview shows live farmer, listing, pending report and zone totals.
- Farmer account management invokes `api/admin-users.php` using session-based admin authorization and CSRF protection. Suspending a farmer prevents future logins and protected API requests.
- Report review in `src/pages/admin-disease-reports.html` supports accepting for review (`under_review`), rejecting with remarks, recording authorized confirmation, and publication after confirmation. **Accepting for review is not a disease diagnosis.**
- Report decisions are validated again server-side; confirmation creation and status update use a transaction.
- Marketplace moderation works when optional `database/migrations/PROPOSED_001_listing_moderation.sql` is installed, otherwise actions are disabled with an explanation.

## Test

1. Log in as admin and open `src/pages/admin-dashboard.html`.
2. View Users, suspend a test farmer, verify protected requests/login are blocked, then reactivate.
3. Submit a disease report with a farmer test account and inspect from Admin > Review disease reports.
4. Accept for review; check `under_review` in the farmer's My Reports. Reject another with a reason.
5. Record confirmation only with legitimate veterinary evidence; then publish. The public map should only show confirmed, published incidents.
6. Test as ordinary farmer: admin endpoints must return HTTP 403.

No changes to database tables required for report review and account suspension, assuming your existing schema supports the statuses and confirmation table. Database integration tests require a running MySQL instance.
