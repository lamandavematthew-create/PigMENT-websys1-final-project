# PigMENT

**A Web-Based Swine Growth Monitoring, Marketplace, and Disease Awareness System for Small-Scale Pig Farmers in Marinduque**

Web Systems and Technologies 1 · Buttercocobonia · BSIT 3C · Marinduque State University  
**Selected sector:** Agriculture & Food Innovation

## Problem and proposed solution

Small-scale pig farmers in Marinduque need practical ways to keep livestock records, estimate live weight when scales are unavailable, advertise pigs for sale, and access pig health information. PigMENT brings these tasks together in one browser-based application. It supports recordkeeping, sales inquiries, and disease awareness without replacing livestock scales, payment services, or veterinary confirmation.

## Core features

| Feature | What users can do |
| --- | --- |
| Pig Growth Monitoring and Weight Estimation | Register pigs, manage pens and litter records, record measurements, and review estimated live weight over time. The quick calculator estimates weight and potential selling value without saving a pig record. |
| Community Livestock Marketplace | Create and manage listings, browse or filter available pigs, view listing details, and contact sellers directly. PigMENT does not process payments. |
| Pig Health Information and Geographic Disease Awareness | Read health and biosecurity information, submit suspected disease reports with location details, and view published incidents and zones. Administrators review reports and record veterinary confirmation details before publication. PigMENT does not diagnose disease. |

## Technologies

HTML5, CSS3, and vanilla JavaScript for the browser interface, PHP with PDO for the API, MySQL-compatible storage, and Leaflet with OpenStreetMap tiles for the interactive map. The local setup uses Apache and MySQL/MariaDB through XAMPP. The map requires internet access to load its tiles.

## Run locally with XAMPP

1. Place the entire existing PigMENT repository folder under `C:\xampp\htdocs\PigMENT`. Keep `src/`, `public/`, `api/`, and `database/` in their current relative locations.
2. Start **Apache** and **MySQL** in XAMPP. In phpMyAdmin, create or select a local database named `pigment_db` and import the team's base schema. **The submitted ZIP does not contain the base schema.** Obtain the team's sanitized schema-only export before trying a fresh install. The files in `database/migrations/` are updates to an existing schema, not a replacement for it.
3. Compare the imported schema with the included migrations. Apply `002_pig_price_per_kg.sql` and `003_marketplace_asking_price_per_kg.sql` only if their respective columns are missing. Use the separate `PROPOSED_001_listing_moderation.sql` only if your team has approved it and the admin listing-moderation feature is part of the demo.
4. For the default local XAMPP database setup, the application falls back to `localhost`, `pigment_db`, `root`, and a blank password. If your local configuration differs, configure `DB_HOST`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD` in the PHP server environment. Keep hosted credentials out of the repository. If testing listing image uploads, ensure PHP can write to `public/assets/uploads/listings/`.
5. Open [http://localhost/PigMENT/src/](http://localhost/PigMENT/src/). Register a farmer account to test the authenticated workflows. Use a team-provisioned admin account for the administrative workflows. Do not include admin credentials in the repository.
6. Smoke-test sign-in, pig registration and weight history, listing creation and filtering, and disease report submission. For the map demo, use clearly labeled test data and an authorized demo admin account. Verify that a pending report is not published.

If your folder name or Apache port differs, adjust the localhost URL accordingly. Do not open the HTML directly or use a static-only server for the full application. GitHub stores the source and documentation. The full demo needs a host that runs PHP and can connect to MySQL.

## Group members

- Dave Matthew O. Laman
- Kristhan Amir Jinrex L. Lope
- Lord Byron H. Saguid
- Ashleigh M. Mahaguay
- Tristan Jonnel S. Garcia

## Documentation

- [Full project documentation](PROJECT_DOCUMENTATION.md)
- [Manuscript PDF](docs/final-manuscript.pdf)
- [AI use and supporting evidence](AI_DISCLOSURE.md)
- [CRediT author contributions](CONTRIBUTIONS.md)
