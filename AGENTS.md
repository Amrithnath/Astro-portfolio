# AGENTS.md

## Source Of Truth
- Trust `package.json`, `astro.config.mjs`, and `.github/workflows/*` over `README.md` when they disagree.
- CI is the runtime truth: Node 20/22, pnpm 8, preview on port `4321`. `sandbox.config.json` still says Node 14/port 3000 and is not authoritative.

## Commands
- Install with `pnpm install --frozen-lockfile` to match CI.
- Use `pnpm dev` for local development.
- Use `pnpm build` for primary verification. There are no repo scripts for lint, test, or typecheck.
- To mirror CI preview checks, run `PORT=4321 pnpm preview` and smoke-test the route with `curl -f http://localhost:4321/<route>`.

## Architecture
- This is a single-package Astro 5 site with `output: 'static'`; do not add SSR-only or server endpoint features to the Astro app.
- `src/pages/index.astro` is a special homepage entrypoint: it does not use `src/layouts/BaseLayout.astro`, inlines its own terminal tabs, and fetches deferred terminal HTML from `src/pages/terminal-full.astro`.
- Homepage content is assembled from `src/data/landing-data-service.ts` and `src/data/resume-compendium.ts`, not from one static data file.
- Most interior routes use `src/layouts/BaseLayout.astro`, which injects `ThemeProvider`, terminal nav/footer, and can replace the page with a WIP screen via `src/data/wip.ts`.
- Markdown project/blog pages use `src/layouts/project.astro` and `src/layouts/blog.astro`, which use the older `ThemeSwitch.astro` flow instead of `BaseLayout`.

## Navigation And Routing
- Route additions are manual across multiple surfaces; update every relevant file yourself.
- Update `src/components/TerminalNav.astro` for interior terminal tabs.
- Update `src/components/Nav.astro` for professional/personal nav.
- Update `src/pages/index.astro` for homepage terminal tabs.
- Update `src/data/navigation.ts` if the route should appear in terminal `ls` output.
- `/blog` meta-refreshes to `/blogs/`.
- `src/pages/blogs.astro` immediately `Astro.redirect('/work-in-progress')`; the page UI below that redirect is currently dead code.

## Styling And Themes
- Do not assume Tailwind; styling is plain CSS in `src/styles/` plus page/component-local styles.
- If an interior page should support theme switching, use the exact wrappers `.terminal-view`, `.professional-view`, and `.personal-view`; `src/components/ThemeProvider.astro` shows/hides those classes and persists the chosen theme in `localStorage`.
- `src/styles/global.css` sets `* { box-sizing: content-box; }`; account for that on pages importing it.

## Formatting
- `.prettierrc` expects semicolons, single quotes, 2-space indentation, `printWidth: 100`, and `prettier-plugin-astro`.
- Prettier is not listed in `package.json`; do not assume a formatter script or local Prettier install exists.
