# AGENTS.md

## Source Of Truth
- Trust `package.json`, `astro.config.mjs`, and `.github/workflows/*` over `README.md` when they disagree.
- CI is the runtime truth: Node 22.23.4/24 (Astro requires >=22.23.4), pnpm 8, preview on port `4321`. `sandbox.config.json` still says Node 14/port 3000 and is not authoritative.

## Commands
- Install with `pnpm install --frozen-lockfile` to match CI.
- Use `pnpm dev` for local development.
- Use `pnpm build` for primary verification. There are no repo scripts for lint, test, or typecheck.
- To mirror CI preview checks, run `PORT=4321 pnpm preview` and smoke-test the route with `curl -f http://localhost:4321/<route>`.

## Architecture
- This is a single-package Astro 7 site with `output: 'static'`; do not add SSR-only or server endpoint features to the Astro app.
- `src/pages/index.astro` is a special homepage entrypoint: it does not use `src/layouts/BaseLayout.astro`, inlines its own terminal tabs, and fetches deferred terminal HTML from `src/pages/terminal-full.astro`.
- Homepage content is assembled from `src/data/landing-data-service.ts` and `src/data/resume-compendium.ts`, not from one static data file.
- Interior routes use `src/layouts/BaseLayout.astro`, which renders terminal nav/footer and one content slot, and can replace the page with a WIP screen via `src/data/wip.ts` (independent of themes).
- Markdown project/blog layouts delegate to `src/layouts/ArticleLayout.astro` and then `BaseLayout`; preserve their article SEO props.
- `src/components/BaseHead.astro` owns SEO, theme bootstrap, token/shell CSS, icons, manifest, and production-only service worker registration. The homepage, redirects, and `/terminal-full/` also use it; do not duplicate head logic or content for themes.
- `/terminal-full/` is a noindex HTML document; the homepage extracts only `[data-terminal-fragment]`, containing commands without a second terminal shell or footer.
- `ServiceWorker.astro` registers `/sw.js?v=<build>` after load, only in production. `src/lib/build-version.ts` supplies one shared version per build.
- Wedding uses its independent `MainHead.astro`; do not change wedding/photography code as part of portfolio theme work. The public `/offline/` fallback is deliberately self-contained and terminal-only.

## Navigation And Routing
- Route additions are manual across multiple surfaces; update every relevant file yourself.
- Update `src/components/TerminalNav.astro` for interior terminal tabs.
- Update `src/pages/index.astro` for homepage terminal tabs.
- Update `src/data/navigation.ts` if the route should appear in terminal `ls` output.
- `/blog` meta-refreshes to `/blogs/`.
- `src/pages/blog.astro` and `src/pages/blogs.astro` use `RedirectPage.astro` meta-refreshes: `/blog` → `/blogs/` → `/work-in-progress`.

## Styling And Themes
- Do not assume Tailwind; styling is plain CSS in `src/styles/` plus page/component-local styles.
- Only `terminal` is registered. Render each page/component once; never add hidden per-theme views or repeated IDs. `.terminal-view` is a structural wrapper, not a visibility switch.
- `src/themes/index.ts` is the typed registry (`id`, `label`, `colorScheme`, `themeColor`, `defaultTheme`). All portfolio documents render `data-theme="terminal"` on `<html>` for no-JS defaults.
- `ThemeBootstrap.astro` runs inline in the head before paint, validates persisted `portfolio-theme`, migrates a valid legacy `portfolio-layout-theme` only when the new key is absent, removes the legacy key, and falls back safely when storage is invalid/blocked. `window.__theme.current` / `window.__theme.set(id)` is the future UI API; invalid IDs return false, valid changes emit `portfolio:theme-change` with `detail.theme`. Storage events synchronize tabs. No switcher is rendered for the single theme.
- To add a theme: (1) register a unique id and metadata in `src/themes/index.ts`; (2) add `src/styles/themes/<id>.css`, scoped to `[data-theme="<id>"]`, defining every semantic and terminal palette token in `terminal.css`; (3) import that file in `BaseHead.astro`; (4) optionally add `[data-theme="<id>"]` component overrides (use `:global([data-theme="<id>"])` in scoped Astro styles); (5) if exposing selection, build a switcher from `themes` only when `themes.length > 1` and call `window.__theme.set(id)`. Do not clone content or add theme-specific route layouts. See `src/themes/README.md`.
- Shell styling in `src/styles/terminal-theme.css` is theme-independent and consumes tokens; prefer `var(--color-bg)`, `var(--color-text)`, `var(--color-surface)`, `var(--color-border)`, `var(--color-link)`, and `var(--color-accent)` for new components. Existing terminal palette aliases remain supported.
- Verify theme changes with `pnpm build`, `node scripts/check-agentic-seo.mjs`, and `node scripts/check-theme-system.mjs` (built HTML, storage/API, and single-instance resume exports/toggles).
- `src/styles/global.css` sets `* { box-sizing: content-box; }`; account for that on pages importing it.

## Formatting
- `.prettierrc` expects semicolons, single quotes, 2-space indentation, `printWidth: 100`, and `prettier-plugin-astro`.
- Prettier is not listed in `package.json`; do not assume a formatter script or local Prettier install exists.
