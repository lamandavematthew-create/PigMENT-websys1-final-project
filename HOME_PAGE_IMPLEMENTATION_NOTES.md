# PigMENT Home Page — Prototype Implementation

Source: PigMENT-websys1-final-project(9).zip

## What changed
- `src/index.html`: the homepage hero now has independent transparent pig mascot, farm scene, and gold accent layers. The Quick Actions, Farm Snapshot, and Farm Reminder use the provided PNG assets while retaining their original links, labels, and data IDs.
- `src/css/home-refresh.css`: new home-only design, matching the prototype's forest-green sidebar, gold button, cream panels, pink/green metric cards, decorative leaves and waves. Includes tablet and smartphone layouts.
- `public/assets/home-redesign/`: optimized copies of the supplied banner and dashboard assets.

## Preserved
- Existing PHP/MySQL APIs, authentication, JavaScript, farming data hooks, Pig Health section and all routes.
- Farm Snapshot values and Farm Log remain loaded by the existing JS/API. Do not expect real data in static screenshots.
- The original pig reminder copy (PG-011) is retained; this is existing static text, not newly derived from the database.

## Validation
- A standalone Chromium static visual preview was rendered at desktop 1440x900, tablet 820x1180, and mobile 390x844. This preview bypasses the login gate solely for screenshots and does not establish that live backend workflows pass.
- No horizontal document overflow at these widths.
- Essential homepage and Pig Health IDs preserved.
- Check login, snapshot, farm log, sidebar navigation and link targets with XAMPP and your actual data before deployment.

## Install
Back up the currently deployed project. Replace the corresponding files in your local XAMPP project, then hard-refresh the browser. Test locally before uploading to InfinityFree.
