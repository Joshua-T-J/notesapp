# Nota

A plain, private notebook. Notes are saved in the browser (localStorage), with no account,
cookies or analytics, and any note exports to Markdown.

- `/` and `/privacy` are prerendered public pages (indexed).
- `/app` is the notes app (client-only, `noindex`).

## Develop

```bash
npm install
npm start            # http://localhost:4200
npm test             # security check + unit tests (Vitest)
npm run build        # security check + production build with prerendering
npm run format       # Prettier
```

Node 22.12+ is required.

## Project layout

```
src/app/
  core/        content (block model, Markdown), notes (model, schema, repository, store),
               theme, settings, seo, export (zip, downloads), feedback (confirm, toasts)
  shared/      icon, menu, confirm dialog, toaster, site header/footer, formatters
  features/    landing, privacy, notes (shell, sidebar, list, editor), settings, not-found
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how data is stored and how a sync backend
plugs in, [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for Vercel, and
[design/UI-DESIGN-SPEC.md](design/UI-DESIGN-SPEC.md) for the design system.

## Before the first deploy

- Set the production URL in `src/app/core/seo/site.ts`, `public/robots.txt` and `public/sitemap.xml`.
- Set a real contact address in `src/app/core/seo/site.ts` (`contactEmail`), shown on the privacy page.
