# Deployment (Vercel)

1. Import the repo in Vercel. `vercel.json` sets the build command (`npm run build`), the output
   directory (`dist/NotesApp/browser`), rewrites for `/app/**` to `index.csr.html`, and headers.
2. No environment variables or secrets are needed: the app has no backend.
3. Before the first production deploy, replace `https://nota-notes.vercel.app` in
   `src/app/core/seo/site.ts`, `public/robots.txt` and `public/sitemap.xml`, and set
   `contactEmail` in `site.ts`.
4. After deploying, open the live site with the browser console open and check that there are no
   Content-Security-Policy errors on `/`, `/privacy` and `/app`.

## If you change `src/index.html`

The inline theme script is allowed by its SHA-256 hash. If you edit it (Prettier counts),
`npm run check:security` fails and prints the new hash: paste it into the
`Content-Security-Policy` value in `vercel.json`.
