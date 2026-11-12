# PigMENT Sunrise login — visual correction

- Revised the live HTML/CSS layout against the approved design instead of using a full mockup screenshot.
- Changed sign-in button back to gold, refined the glass-cream panel, and adjusted headline/feature spacing.
- Fixed the mascot clipping: independently sized PNG with `object-fit:contain` and anchored at bottom.
- Added a farm-scene photo crop and foliage from approved imagery, each as separate aspect-ratio-safe layers (no stretching).
- Kept the existing login form IDs, names, auth.js bindings, endpoints, registration link, and backend files.
- The background is built from separate layers; it will not be pixel-identical to the full composite illustration.
- Live API login requires testing in XAMPP with the existing MySQL database.
