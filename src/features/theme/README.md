# Portfolio themes

`terminal` (dark) and `light` (warm paper terminal profile) are enabled. Themes change tokens and optional
component styling, not content trees: render every component once and keep IDs unique.

## Light terminal profile

The light profile uses a warm cream, untextured transcript with sand window chrome,
traffic-light controls, a green active-tab rule and a separate statusline. Fira Code,
`user@host:~$` prompts, ANSI-style green/blue/magenta/cyan/red inks and the block cursor
are the same terminal language as dark; prompts are bold to distinguish input from
regular-weight output. Cards/buttons are square terminal-tool panels, not rounded website
tiles. No scanlines or decorative background overlay obscure text.

Colors live only in `src/features/theme/styles/themes/light.css`; light-only shell and primitive
rules live in `src/features/terminal/terminal-theme.css` and `src/shared/styles/ui.css`.
Dark selectors/tokens are unchanged.
The registry's light `themeColor` matches the transcript background. Keep foregrounds
AA on the transcript, surface **and** titlebar; keep inverse labels AA on ANSI fills.

Key WCAG contrast ratios (foreground / cream transcript / sand surface / titlebar):

| Ink | Transcript `#f8f4ea` | Surface `#eee8d9` | Titlebar `#e4dcc8` |
| --- | --- | --- | --- |
| Text `#2e2922` | 13.13:1 | 11.80:1 | 10.55:1 |
| Muted `#5a5246` | 7.00:1 | 6.29:1 | 5.63:1 |
| Prompt green `#2b6436` | 6.42:1 | 5.77:1 | 5.16:1 |
| Link blue `#1d4f97` | 7.30:1 | 6.56:1 | 5.87:1 |
| Cyan `#0e5f6e` (lowest ANSI pair) | 6.64:1 | 5.96:1 | 5.34:1 |

Inverse cream labels on green/blue are 6.42:1 / 7.30:1.

## Command highlighting

`Prompt.astro` renders commands through `src/shared/ui/ShellCommand.astro`, which tokenises them at
build time with `src/shared/lib/shell-highlight.ts` (zsh-syntax-highlighting style: `.sh-cmd`,
`.sh-flag`, `.sh-string`, `.sh-var`, `.sh-op`, `.sh-path`, `.sh-arg`). Token colours are semantic
tokens in `terminal-theme.css`, so every theme gets them. The resume CLI echo uses the same tokenizer
with `textContent` only. Tests: `pnpm test:shell`.

## Wide-screen side panes

At `min-width: 110rem` `TerminalShell` shows tmux-style panes in the desktop gutters
(`src/features/terminal/SidePanes.astro`, pure helpers in `panes.ts`, tested by `pnpm test:shell`).
They vary with the page through the `panes` prop (`PaneContext`) passed by pages, `BaseLayout` and
`ArticleLayout`:

- **Left (`0:man`)**: a `man ./<page>` entry (name, synopsis, description, in-page sections, see
  also), then `git log --graph ~/career` from the resume compendium. Articles mark the role current
  at their `pubDate`; `/resume` expands each role's technologies. Photography routes show albums,
  places and tags instead of the career graph.
- **Right (`1:whoami`)**: `neofetch --short` contact details (latest photos on photography routes),
  `htop` skill meters (bar fill is years relative to the most-practised skill, colour is the level;
  articles show matching tech/tags, `/resume` shows every category) and `tail -f ~/.now`, which stays
  hidden while `/now` is a placeholder.

They sit below the sticky chrome (`--chrome-height`), scroll independently, are outside `<main>`
(not indexed) and are hidden on narrower screens and in print. Only link listed routes there, except
photography links on photography routes.

## Add a theme

1. Add `{ id, label, colorScheme, themeColor }` to `themes` in `index.ts`.
   `ThemeId` updates automatically. `defaultTheme` also controls the server-rendered
   HTML default on all Astro portfolio pages.
2. Copy `src/features/theme/styles/themes/terminal.css` to `src/features/theme/styles/themes/<id>.css`. Change its scope to
   `[data-theme='<id>']` and supply every semantic token **and** terminal palette alias.
   A theme must define: `--color-bg/surface/border/text/muted/secondary/heading/accent/link/on-accent`,
   `--color-success/warning/danger/info`, `--color-overlay/overlay-strong`, `--color-shadow`,
   `--window-control-close/min/max`, `--font-mono`, and the `--terminal-*` aliases (see
   `terminal.css`). Spacing, type, radius and layout tokens live in theme-agnostic `src/features/theme/styles/tokens.css`.
   `--font-mono` controls the shell font. Import the file in `BaseHead.astro` so it
   is available before paint. Shell rules in `src/features/terminal/terminal-theme.css` work for all themes.
3. For optional overrides, use `[data-theme='<id>'] .component` in global CSS, or
   `:global([data-theme='<id>']) .component` inside an Astro component's scoped style.
   Never reintroduce hidden alternate views, repeated IDs, or theme-dependent data.
4. The statusline switcher in `ThemeSwitcher.astro` lists the registry plus auto;
   hide/omit it while `themes.length < 2`. Call `window.__theme.set(id)` to select.
   The API returns false for invalid IDs, exposes the resolved id as `window.__theme.current`
   and the choice as `preference`, updates color-scheme and theme-color, and emits `portfolio:theme-change` with `{ theme: id, preference }` in `detail`.
   `set('auto')` or `auto()` clears storage and follows the system scheme live.

`ThemeBootstrap.astro` is a synchronous inline head script in `BaseHead.astro`. It
validates `portfolio-theme` against serialized registry IDs before paint, migrates a
valid `portfolio-layout-theme` only if the new key is absent, removes the old key,
and follows the system scheme on invalid values or unavailable storage. Changes
persist when storage is available and synchronize between tabs. Auto is represented
by no stored key; explicit choices store `terminal` or `light`. The switcher uses
native pressed buttons, initializes once per page load, and stays hidden without JS.
Server HTML and CSS provide the terminal default even without JavaScript.

`BaseHead` also preserves SEO, icons/manifest and production service worker setup.
Blog/project articles reuse `BaseLayout`/`TerminalShell` with `.prose`. The homepage uses the same `TerminalShell` and
extracts only deferred commands from `/terminal-full/`. The public `/offline/` page
is a self-contained terminal fallback (a small inline token snapshot); wedding is
independent and deliberately excluded from this system.

Run `pnpm build`, `node scripts/check-agentic-seo.mjs`, and
`node scripts/check-theme-system.mjs` after changes; smoke-test with preview as well.

## Navigation and sharing

Every navigation is a full document load with native cross-document view transitions
(`@view-transition { navigation: auto; }`) and Astro prefetch. ClientRouter is intentionally
not used: its swaps copy the server's default `data-theme` onto `<html>` and flash the wrong
theme. The blocking head bootstrap applies the saved theme before first paint on each page;
page scripts initialize directly and guard DOM roots against double binding.
The shared shell includes a keyboard skip link. Semantic text tokens meet WCAG AA
on both background and elevated surfaces (checked in the theme verification script). Reduced-motion disables transition
animations, and local Fira Code CSS uses `font-display: swap`.

Static `/og/*.png` routes render terminal-style social cards (1200×630) at build
time with resvg, the terminal palette and bundled OFL Fira Code. `src/features/seo/og.ts`
maps top-level pages; published blog/project cards use collection titles. Unknown
non-article routes use `/og/default.png`. The SEO component supplies image URLs,
type, dimensions and descriptive alternatives; no server or runtime font is needed.
