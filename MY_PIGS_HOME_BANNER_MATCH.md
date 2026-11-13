# My Pigs banner — exact Home component reuse

- `src/pages/my-pigs.html` now uses the same `dashboard-hero`, `dashboard-hero-copy`, `hero-art`, `hero-farm`, `hero-mascot` and `hero-rays` HTML structure as `src/index.html`.
- Both pages use `src/css/home-refresh.css` for identical banner dimensions, background treatment, image positions, font styles, and mobile breakpoints.
- Both banners reference the same `public/assets/home-redesign/` artwork, preserving the same illustration and yellow rays placement.
- My Pigs retains page-specific heading text: **Growth monitoring / My Pigs / View your pig records, keep track of growth, and update your farm list.**
- The My Pigs banner intentionally has **no Register a Pig button**; the existing Register a Pig shortcut directly below the banner remains functional.
- Other My Pigs records, filters, buttons, pens, forms, API calls and JS are unchanged.
- The My Pigs main content container now uses the same max width and padding as Home to maintain equivalent banner scale.
- Browser- and database-connected functional testing is still recommended before live deployment.
