# PigMENT Web Systems and Technologies 1 Final Project

## Project structure

- `src/` - Application pages, stylesheets, and JavaScript source files.
- `public/` - Public static assets.
- `docs/` - Final manuscript and related documentation. Add the team-approved `final-manuscript.pdf` here when available.
- `PROJECT_DOCUMENTATION.md` - Project documentation template.
- `AI_DISCLOSURE.md` - AI usage disclosure template.
- `CONTRIBUTIONS.md` - Team contribution template.

## Running the application

The static application entry point is [`src/index.html`](src/index.html). Serve the `src` directory with any static file server, then open the server URL:

```text
python -m http.server 8000 --directory src
```

For the authenticated PHP/MySQL features, use XAMPP instead of opening an HTML file directly:

```text
http://localhost/PigMENT/src/
```

Apache must serve the project from `C:\xampp\htdocs`, and MySQL must be running. Do not use a `file:///...` URL; browser security and PHP requests will not work correctly from a local file.

The public weight tool is available at [`src/pages/weight-calculator.html`](src/pages/weight-calculator.html). It uses the documented girth-and-length estimate locally and does not save guest inputs.