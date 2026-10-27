# AGENTS.md

## Source Of Truth
- Trust `package.json`, `astro.config.mjs`, and `.github/workflows/*` over `README.md` when they disagree.
- CI is the runtime truth: Node 26 current release line (pinned in `.nvmrc`; CI also builds on the latest Node), pnpm 10 (pinned via `packageManager`), preview on port `4321`. `sandbox.config.json` still says Node 14/port 3000 and is not authoritative.

## Commands
- Install with `pnpm install --frozen-lockfile` to match CI.
- Use `pnpm dev` for local development.
- Use `pnpm check` for Astro/TypeScript diagnostics and `pnpm build` to generate the static site.
- Use `pnpm check:seo`, `pnpm check:theme`, and `pnpm check:links` to validate the built `dist/`; `pnpm verify` builds and runs all three.
- Use `pnpm exec playwright install chromium` once, then `pnpm test:e2e` after building for Chromium smoke tests and axe-core accessibility checks (`tests/e2e/a11y.spec.ts`, fails on serious/critical WCAG 2.1 AA violations). The test runner starts its own preview on port `4321`; use `PORT=4326 pnpm test:e2e` if that port is occupied.
- CI (`.github/workflows/ci.yml`, "Portfolio Quality") runs all of the above plus `pnpm audit --prod` on every push/PR. There is no lint script.
- To mirror CI preview checks, run `PORT=4321 pnpm preview` and smoke-test the route with `curl -f http://localhost:4321/<route>`.

## Architecture
- This is a single-package Astro 7 site with `output: 'static'`; do not add SSR-only or server endpoint features to the Astro app.
- `src/pages/index.astro` is a special homepage entrypoint: it does not use `src/layouts/BaseLayout.astro` but renders the same `src/components/TerminalShell.astro` (window chrome, `TerminalNav` tabs, status bar, footer) and fetches deferred terminal HTML from `src/pages/terminal-full.astro`.
- Homepage content is assembled from `src/data/landing-data-service.ts` and `src/data/resume-compendium.ts`, not from one static data file.
- Interior routes use `src/layouts/BaseLayout.astro`, which renders terminal nav/footer and one content slot, and can replace the page with a WIP screen via `src/data/wip.ts` (independent of themes).
- Blog Markdown lives in `src/content/blog/`; projects live in `src/content/projects/` (preserve case-sensitive subfolders such as `webDev/`). `src/content.config.ts` defines Content Layer glob loaders and Zod schemas; IDs are file paths without `.md` so existing URLs remain stable.
- To add a post/project: create a Markdown file in the corresponding collection with `title`, `description`, and `pubDate` (ISO date). `tags` defaults to `[]` and `draft` to `false`; `updatedDate`, `img`/`image` (absolute URLs), and `lang` are optional. Projects also accept optional `link`, `client`, `github`, `live`, `demo`, and `tech`. Do not add `layout:` frontmatter. Dynamic `/blog/[...slug]` and `/project/[...slug]` routes render the existing layouts. `draft: true` is available in development but excluded from production routes, lists, Markdown mirrors, LLM discovery, sitemap, and RSS.
- All collection consumers use `src/lib/content.ts` (`getCollection` with shared draft filtering and URL generation). `/rss.xml` lists published blog posts; `BaseHead.astro`, `/llms.txt`, and `/robots.txt` advertise it. Markdown mirrors use collection bodies; the profile compendium remains separate.
- Markdown project/blog layouts delegate to `src/layouts/ArticleLayout.astro` and then `BaseLayout`; preserve their article SEO props.
- `src/components/BaseHead.astro` owns SEO, theme bootstrap, token/shell CSS, icons, manifest, and production-only service worker registration. The homepage, redirects, and `/terminal-full/` also use it; do not duplicate head logic or content for themes.
- `/terminal-full/` is a noindex HTML document; the homepage extracts only `[data-terminal-fragment]`, containing commands without a second terminal shell or footer.
- `BaseHead` enables Astro ClientRouter only on indexable portfolio pages; page scripts must initialize on `astro:page-load` and guard against duplicate handlers. Theme bootstrap reruns safely after swaps.
- Static `/og/*.png` endpoints render 1200×630 terminal social cards with resvg and bundled OFL Fira Code; `src/lib/og.ts` owns page mapping. Keep SEO image dimensions and build checks aligned.
- `ServiceWorker.astro` registers `/sw.js?v=<build>` after load, only in production. `src/lib/build-version.ts` supplies one shared version per build.
- Wedding uses its independent `MainHead.astro`; do not change wedding/photography code as part of portfolio theme work. The public `/offline/` fallback is deliberately self-contained and terminal-only.

## Navigation And Routing
- Route additions are manual across multiple surfaces; update every relevant file yourself.
- Update `src/components/TerminalNav.astro` (shared by homepage and interior pages via `TerminalShell`).
- Update `src/data/navigation.ts` if the route should appear in terminal `ls` output.
- `/blog` meta-refreshes to `/blogs/`.
- `src/pages/blog.astro` and `src/pages/blogs.astro` use `RedirectPage.astro` meta-refreshes: `/blog` → `/blogs/` → `/work-in-progress`.

## Styling And Themes
- Do not assume Tailwind; styling is plain CSS in `src/styles/` plus page/component-local styles.
- Only `terminal` is registered. Render each page/component once; never add hidden per-theme views or repeated IDs. 
- `src/themes/index.ts` is the typed registry (`id`, `label`, `colorScheme`, `themeColor`, `defaultTheme`). All portfolio documents render `data-theme="terminal"` on `<html>` for no-JS defaults.
- `ThemeBootstrap.astro` runs inline in the head before paint, validates persisted `portfolio-theme`, migrates a valid legacy `portfolio-layout-theme` only when the new key is absent, removes the legacy key, and falls back safely when storage is invalid/blocked. `window.__theme.current` / `window.__theme.set(id)` is the future UI API; invalid IDs return false, valid changes emit `portfolio:theme-change` with `detail.theme`. Storage events synchronize tabs. No switcher is rendered for the single theme.
- To add a theme: (1) register a unique id and metadata in `src/themes/index.ts`; (2) add `src/styles/themes/<id>.css`, scoped to `[data-theme="<id>"]`, defining every semantic and terminal palette token in `terminal.css`; (3) import that file in `BaseHead.astro`; (4) optionally add `[data-theme="<id>"]` component overrides (use `:global([data-theme="<id>"])` in scoped Astro styles); (5) if exposing selection, build a switcher from `themes` only when `themes.length > 1` and call `window.__theme.set(id)`. Do not clone content or add theme-specific route layouts. See `src/themes/README.md`.
- Shell styling in `src/styles/terminal-theme.css` is theme-independent and consumes tokens; prefer `var(--color-bg)`, `var(--color-text)`, `var(--color-surface)`, `var(--color-border)`, `var(--color-link)`, and `var(--color-accent)` for new components. Existing terminal palette aliases remain supported.
- Verify theme changes with `pnpm build`, `node scripts/check-agentic-seo.mjs`, and `node scripts/check-theme-system.mjs` (built HTML, storage/API, and single-instance resume exports/toggles).
- Token layers: `src/styles/tokens.css` (theme-agnostic spacing `--space-1..8`, type `--text-xs..3xl`, line-heights, `--radius-*`, `--content-width`, `--shell-width`, `--shell-padding`, z-index, transitions) and `src/styles/themes/<id>.css` (colors only: semantic `--color-*`, `--window-control-*`; `--terminal-*` are aliases). Do not hardcode hex/rgb outside theme files, the resume print `--print-*` block, and `public/offline/index.html` (static token snapshot).
- Primitives: `src/components/ui/{TerminalWindow,Prompt,Card,Button}.astro`, shared classes in `src/styles/ui.css`, and `.prose` in `src/styles/prose.css` (use for Markdown/long text). Pages should use these instead of page-local CSS; `TerminalShell` is the single shell for all pages.
- `src/styles/global.css` sets `*, *::before, *::after { box-sizing: border-box; }`. Breakpoints (not usable as custom properties): `48rem` (md) and `64rem` (lg). Links use `--color-link` (hover `--color-accent`), fonts `--font-mono`; animations must respect `prefers-reduced-motion` (global rule exists).

## Formatting
- `.prettierrc` expects semicolons, single quotes, 2-space indentation, `printWidth: 100`, and `prettier-plugin-astro`.
- Prettier is not listed in `package.json`; do not assume a formatter script or local Prettier install exists.

## Versioning And Releases
- `package.json` and `.release-please-manifest.json` are the source of the current application version. The site footer reads that version at build time, and `/version.json` reports it with the build commit and timestamp; its response must remain revalidated (`public/_headers`).
- Use `<type>(<optional scope>): <emoji> <subject>` for PR titles and commits. The Conventional Commit type must be first and the subject must start with the actual Unicode emoji (not a shortcode). Preferred type-to-emoji mapping: `feat` ✨, `fix` 🐛, `perf` ⚡, security fixes (`fix`) 🔒, `refactor` ♻️, `docs` 📝, `ci` 👷, `build` 📦, `chore` 🔧, `style` 💄, `test` ✅, and `revert` ⏪. Breaking changes use `feat!: 💥 ...`. Examples: `feat: ✨ add version endpoint` and `feat!: 💥 replace public API`. Security fixes use `fix: 🔒 ...`, not a `security:` commit type. `pnpm commitlint --from <base> --to <head>` checks a commit range locally; PR checks validate titles and commit messages.
- Release Please runs on pushes to `main`, opens/updates a release PR from conventional commits, and creates the `vX.Y.Z` tag and GitHub release when that PR is merged. It updates the package version and generated `CHANGELOG.md`. Do not hand-edit the changelog after the seeded 2.0.0 entry. A `RELEASE_PLEASE_TOKEN` secret is optional: configure a PAT if release PRs must trigger other `GITHUB_TOKEN`-driven workflows, because GitHub suppresses most downstream workflow runs for events created with `GITHUB_TOKEN`; otherwise the default token is sufficient.
- One-time 2.0.0 bootstrap after the integration branch is merged and pushed to `main`: to avoid Release Please proposing or publishing 2.0.0 again, create the initial release at that exact merge commit before relying on subsequent automation. On `main`, run `git tag -a v2.0.0 -m 'Release v2.0.0' <merge-commit-sha>`, push it with `git push origin v2.0.0`, then create a GitHub release for the existing `v2.0.0` tag (the seeded changelog documents the release). The next conventional changes on `main` will then produce a 2.0.1/2.1.0 release PR as appropriate. Do not tag the feature branch tip if its merge creates a different commit. Alternatively, leave off the initial tag and let Release Please bootstrap, but review its first PR/tag carefully and do not also create a manual 2.0.0 release.
