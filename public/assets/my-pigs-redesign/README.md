# PigMENT My Pigs UI Asset Pack

Created for the latest approved My Pigs prototype.

- `illustrations/`: reused transparent mascot and pigpen illustration from the prior Home banner pack.
- `icons/svg/` and `icons/png/`: clean, scalable approximations of the mockup icons (navigation, pig data, actions, status). These are newly made assets, **not exact extracted icon layers**.
- `decorations/svg/` and `decorations/png/`: green banner base, leaves, waves, gold accent; reusable in CSS.

Keep text, numbers, search, buttons, filters, status badges, and actions as real HTML/CSS/JS elements. Any specific pig photo should come from the user's actual pig image rather than a decorative stock or mock image. The reference prototype is a flattened illustration, so its exact layers cannot be exported individually. Do not treat its sample ID, dates, weights, or pen records as real data.

Recommended integration: place optimized assets under `public/assets/my-pigs/`; use SVGs for icons where safe, WebP/PNG for detailed illustration, and CSS backgrounds using `background-size: cover` or `contain` according to intent.
