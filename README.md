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

The project does not include a package manager, build step, backend, or database. The pages use browser storage for demonstration data.