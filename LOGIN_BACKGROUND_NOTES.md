# PigMENT fullscreen responsive login background

Desktop image: `public/assets/pigment-login-desktop.webp` (1672x941 source, proportional cover).
Mobile image: `public/assets/pigment-login-mobile.webp` (941x1672 source, proportional cover).
The page switches to the portrait background at viewport widths of 900px or less. Both images use `background-size:cover; background-position:center top` (mobile) and `center center` (desktop); edges may crop to fill unusually shaped viewports but images never stretch.

The original PHP API and authentication JS are unchanged. Login form controls are real HTML. No mockup image is used as the whole login form. Login on a live PHP/MySQL server must be tested separately.
