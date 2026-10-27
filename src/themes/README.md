# Portfolio themes

Only `terminal` is enabled. Themes change tokens and optional component styling, not
content trees: render every component once and keep IDs unique.

## Add a theme

1. Add `{ id, label, colorScheme, themeColor }` to `themes` in `index.ts`.
   `ThemeId` updates automatically. `defaultTheme` also controls the server-rendered
   HTML default on all Astro portfolio pages.
2. Copy `src/styles/themes/terminal.css` to `<id>.css`. Change its scope to
   `[data-theme='<id>']` and supply every semantic token **and** terminal palette alias.
   A theme must define: `--color-bg/surface/border/text/muted/secondary/heading/accent/link/on-accent`,
   `--color-success/warning/danger/info`, `--color-overlay/overlay-strong`, `--color-shadow`,
   `--window-control-close/min/max`, `--font-mono`, and the `--terminal-*` aliases (see
   `terminal.css`). Spacing, type, radius and layout tokens live in theme-agnostic `tokens.css`.
   `--font-mono` controls the shell font. Import the file in `BaseHead.astro` so it
   is available before paint. Shell rules in `terminal-theme.css` work for all themes.
3. For optional overrides, use `[data-theme='<id>'] .component` in global CSS, or
   `:global([data-theme='<id>']) .component` inside an Astro component's scoped style.
   Never reintroduce hidden alternate views, repeated IDs, or theme-dependent data.
4. A future switcher should list registry labels and call `window.__theme.set(id)`;
   hide/omit it while `themes.length < 2`. The API returns false for invalid IDs,
   exposes the selected id as `window.__theme.current`, updates color-scheme and
   theme-color, and emits `portfolio:theme-change` with `{ theme: id }` in `detail`.

`ThemeBootstrap.astro` is a synchronous inline head script in `BaseHead.astro`. It
validates `portfolio-theme` against serialized registry IDs before paint, migrates a
valid `portfolio-layout-theme` only if the new key is absent, removes the old key,
and falls back to the default on invalid values or unavailable storage. Changes
persist when storage is available and synchronize between tabs. Server HTML and CSS
provide the terminal default even without JavaScript.

`BaseHead` also preserves SEO, icons/manifest and production service worker setup.
Blog/project articles reuse `BaseLayout`/`TerminalShell` with `.prose`. The homepage uses the same `TerminalShell` and
extracts only deferred commands from `/terminal-full/`. The public `/offline/` page
is a self-contained terminal fallback (a small inline token snapshot); wedding is
independent and deliberately excluded from this system.

Run `pnpm build`, `node scripts/check-agentic-seo.mjs`, and
`node scripts/check-theme-system.mjs` after changes; smoke-test with preview as well.
