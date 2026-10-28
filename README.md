# Astro Portfolio

[![CI](https://img.shields.io/github/actions/workflow/status/Amrithnath/Astro-portfolio/ci.yml?branch=main&label=CI)](https://github.com/Amrithnath/Astro-portfolio/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/package-json/v/Amrithnath/Astro-portfolio?label=version)](CHANGELOG.md)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue)](LICENSE)
[![Astro](https://img.shields.io/badge/Astro-7-ff5d01?logo=astro&logoColor=white)](https://astro.build/)
[![Node.js](https://img.shields.io/badge/node-%3E%3D24-339933?logo=node.js&logoColor=white)](.nvmrc)
[![pnpm](https://img.shields.io/badge/pnpm-12-f69220?logo=pnpm&logoColor=white)](package.json)
[![Lighthouse](https://img.shields.io/badge/Lighthouse-4%C3%97100-brightgreen?logo=lighthouse&logoColor=white)](#lighthouse)

The source for [amrithnath.dev](https://amrithnath.dev): a fast, static, terminal-styled portfolio
and blog built with [Astro](https://astro.build/).

- **Fast and static**: Astro `output: 'static'`, inline critical CSS, AVIF images, 4×100 Lighthouse.
- **Terminal UI**: one accessible content tree with a token-based theme registry.
- **Built for search and AI**: canonical metadata, JSON-LD, RSS, sitemap, `llms.txt` and Markdown mirrors.
- **Blog editor**: [Sveltia CMS](https://sveltiacms.app) at `/admin`; every edit becomes a pull request.
- **Checked on every change**: type checks, build contracts, Playwright + axe, CodeQL and Lighthouse.

## Contents

1. [Getting started](#getting-started)
2. [Project structure](#project-structure)
3. [Writing content](#writing-content)
4. [Testing and quality](#testing-and-quality)
5. [CI/CD and deployment](#cicd-and-deployment)
6. [Search and AI discovery](#search-and-ai-discovery)
7. [Themes](#themes)
8. [Contributing and releases](#contributing-and-releases)
9. [License](#license)

## Getting started

**Prerequisites**

- Node.js 26 (pinned in `.nvmrc`). Node 24 LTS also works (`engines` is `>=24`; Vercel uses it).
- pnpm 12 (pinned via `packageManager`).

```bash
git clone https://github.com/Amrithnath/Astro-portfolio.git
cd Astro-portfolio
pnpm install --frozen-lockfile
pnpm dev            # http://localhost:4321
```

**Scripts**

| Script | What it does |
| --- | --- |
| `pnpm dev` | Start the dev server |
| `pnpm build` / `pnpm preview` | Build the static site to `dist/` / serve it locally |
| `pnpm check` | Astro and TypeScript diagnostics |
| `pnpm verify` | Build, then check SEO output, the theme system, internal links and `vercel.json` headers |
| `pnpm sync:headers` | Regenerate `vercel.json` headers from `public/_headers` |
| `pnpm check:photos` | Fail if a gallery photo has GPS data or no catalogue entry |
| `pnpm test:e2e` | Playwright smoke and accessibility tests (run after a build) |
| `pnpm test:cms-auth` | Unit tests for the CMS sign-in Worker |
| `pnpm test:views` | Unit tests for the article view counter Worker |
| `pnpm lighthouse` | Lighthouse CI against `dist/` (`LIGHTHOUSE_DESKTOP=1` for desktop) |
| `pnpm commitlint --from <base> --to <head>` | Check commit messages |

**Toolchain notes**

- Dependency build scripts must be allowed in `pnpm-workspace.yaml` (`allowBuilds` for pnpm 12,
  `onlyBuiltDependencies` for pnpm 9/10). `pmOnFail: ignore` keeps the lockfile readable by older
  pnpm versions such as Vercel's.
- pnpm rejects packages published less than 24 hours ago (`minimumReleaseAge`), so very new
  releases install a day later.
- TypeScript stays on 5.9. TypeScript 6/7 stricter defaults surface nullability errors in the
  resume data; that migration is deferred instead of weakening checks.

## Project structure

```
├── src/
│   ├── pages/           # Routes, including /admin, RSS, llms.txt and OG images
│   ├── layouts/         # BaseLayout and article layouts
│   ├── components/      # Terminal shell, SEO head and UI primitives
│   ├── content/         # Blog and project Markdown (Content Layer collections)
│   ├── data/            # Profile and resume data
│   ├── lib/             # Content, SEO and OG helpers
│   ├── styles/          # Tokens, themes and shared CSS
│   └── themes/          # Theme registry
├── public/              # Static files, _headers, service worker, CMS config
├── workers/cms-auth/    # Cloudflare Worker for CMS sign-in
├── workers/views/       # Cloudflare Worker + D1 for article view counts
├── scripts/             # Build output checks
├── tests/e2e/           # Playwright tests
└── .github/workflows/   # CI, releases and deploys
```

Paused projects, such as the wedding upload stack, live in [`project-archive/`](project-archive/README.md).

## Writing content

### Markdown

Blog posts live in `src/content/blog/` and projects in `src/content/projects/`. The schemas are in
`src/content.config.ts`. Published posts are listed newest first at `/blog/`; `draft: true` keeps a
post out of production. Redirects live in `public/_redirects` (Cloudflare) and are mirrored into
`vercel.json` by `pnpm sync:headers`.

```yaml
---
title: My post
description: A short summary.
pubDate: 2026-10-27
updatedDate: 2026-10-28 # optional
tags: [Astro]
draft: false
img: /images/blog/cover.jpg # optional: absolute URL or site path
---
```

- Optional fields: `img` or `image` (local `/public` images also appear in OG cards), and `lang`.
  Projects also accept `link`, `client`, `github`, `live`, `demo`, `tech`, `status` (`active`,
  `maintained`, `archived` or `concept`) and `featured`. Blog posts may set `project` to a project
  file ID (for example `webDev/weather-app`) to connect a write-up to its project page.
- Projects are long-form articles at `/project/<file-id>/`; `/projects/` includes technology filters
  and related write-up counts. Draft articles stay out of public project and write-up links in production.
- Don't add `layout:`. File paths set the URL and keep their case:
  `projects/webDev/weather-app.md` publishes at `/project/webDev/weather-app/`.
- Drafts show in development only. Production leaves them out of pages, lists, RSS, the sitemap
  and LLM files.

### Blog editor (`/admin`)

`/admin` runs a self-hosted, pinned Sveltia CMS (`public/admin/config.yml`). You sign in with a
GitHub App through the Worker in `workers/cms-auth/`, hosted at `cms-auth.amrithnath.dev`.

Each save commits to a `cms/blog/<slug>` branch and opens a pull request, so CI and preview deploys
run before anything reaches production. Publishing in the CMS merges the PR. Uploaded images go to
`public/images/blog/`.

**One-time setup**

1. Create a GitHub App (Settings → Developer settings → GitHub Apps):
   - callback URL `https://cms-auth.amrithnath.dev/callback`
   - webhook off
   - **Expire user authorization tokens** on
   - repository permissions **Contents** and **Pull requests**: read and write

   Install the app on this repository only, then generate a client secret.
2. Create a Cloudflare API token with **Workers Scripts: Edit** (account), plus **Workers Routes:
   Edit** and **DNS: Edit** on the `amrithnath.dev` zone.
3. Add these repository secrets, then run the **CMS Auth Worker** workflow:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
   - `CMS_GITHUB_CLIENT_ID`
   - `CMS_GITHUB_CLIENT_SECRET`

   After that, the workflow redeploys the Worker on every change to `workers/cms-auth/`.

### Photography (`/photography/`)

The gallery and **all** its tag, place, album, trip and individual-photo pages are **unlisted**:
noindex, no sitemap/LLM discovery and no links from the rest of the site. This is not access control;
anyone with a URL can view published photos. CLI-style flag buttons filter without typing;
without JavaScript, the grid and linked tag/place pages still work.

Use the **Photography** and **Albums and trips** collections in `/admin` to edit metadata.
Tags are normalized to lowercase kebab-case and deduplicated. Location is an optional object:
`{ name, region?, country?, lat?, lng?, maps? }`; coordinates must have **at most two decimals**
(roughly 1 km, not precise GPS). Leave unknown locations unset; do not guess.

**Locations from links and metadata.** Paste a Google Maps link into `maps` (CMS: *Google Maps
link*), preferably to the town or landmark rather than your exact spot. Full links
(`google.com/maps/place/…`, `/@lat,lng`, `?q=lat,lng`) fill in the name and rounded
coordinates at build time. Short `maps.app.goo.gl` links need expanding: the **Locate photos**
workflow does this on photo PRs (`pnpm photos:locate` locally). It also fills missing
name/region/country from coordinates via OpenStreetMap, then **removes the pasted link**, keeping
only the rounded location. Ingest reads GPS from EXIF and names the place the same way. Place
pages credit OpenStreetMap (ODbL).
Photos reference any number of albums. Trips are albums with `kind: trip`, date ranges and
ordered itinerary stops; `src/content/albums/example-trip.yml` is a draft template.

**Local photos:** export without GPS metadata, put the original in `src/assets/photos/` and add
`src/content/photos/<slug>.yml` with title, image path and alt text. `pnpm check:photos` rejects
GPS-bearing originals and uncatalogued assets. Astro emits metadata-free AVIF/WebP derivatives.
Optional fields include caption, date, camera, lens, settings, tags, albums, featured and draft.
Use exactly one image source: local `image` **or** R2 `remote: { key, width, height, placeholder? }`.
Photo IDs `tags`, `places`, `albums`, `map`, `prints`, `feed`, `feed.xml`, `rss` and `rss.xml` are reserved.

**Extras (still unlisted):** places link to `/photography/map/`, an inline SVG with no third-party
requests. One linked marker per named place uses reviewed, coarse coordinates; the text list is
available without JavaScript. Unknown locations stay unset. The bundled simplified Natural Earth
110m land outline is public domain (source, version and licence in `src/data/world-land.json`).
`/photography/rss.xml` lists published photos newest first (undated last), with metadata-free
WebP media links; only the photography index advertises it. The optional `exiftool`-style photo
panel shows camera, lens, taken date and exposure fields, never GPS or serial numbers. Ingest fills
`focalLength` (mm), `aperture` (f-number), `exposureTime` (seconds) and `iso` when available;
these are also editable in the CMS. Photos with no EXIF information have no panel.
`/photography/prints/` is explicitly **PLACEHOLDER**: the owner must supply print availability,
prices/delivery and licensing terms before treating it as an offer. Contact uses the profile email;
all photos remain © the owner, all rights reserved unless stated otherwise.

**R2 ingest (no local Cloudflare login required):**

1. Create **two different R2 buckets**: a private inbox for originals and a public derivatives
   bucket. Never expose the inbox; originals may contain GPS. Connect custom domain
   `photos.amrithnath.dev` to the public bucket (source config: `src/data/photos-config.ts`).
2. Create an R2 API token scoped to both buckets with object read/write permissions.
   Add repository secrets `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY`;
   add repository variables `R2_INBOX_BUCKET` and `R2_PUBLIC_BUCKET` with the bucket names.
3. Optionally add secret `PHOTOS_PR_TOKEN` (a repository-scoped token with Contents and Pull
   requests write permissions) so ingest PRs trigger CI. Otherwise enable Actions to create PRs;
   PRs created using `GITHUB_TOKEN` do **not** trigger CI automatically.
4. Drag-drop originals into the private inbox using Cloudflare's dashboard from any device.
   Run **Photo ingest** in GitHub Actions, optionally selecting an existing album slug,
   comma-separated tags and a Google Maps link for the whole batch. Otherwise the location comes
   from EXIF GPS (rounded, then named via OpenStreetMap). It downloads originals privately, strips metadata, uploads AVIF/WebP
   widths 480/800/1200/1600/2400 (never upscaled), and opens a metadata-only PR. After the PR
   succeeds, originals move to `archive/` **in the private inbox**, not the public bucket.
5. In the PR/CMS, replace TODO alt text, check the place name (or remove an unwanted location),
   review rounded coordinates/tags/album membership, then set `draft: false` to publish.
   Ingested entries default to drafts. Existing entries are never overwritten; move or rename
   duplicate inbox files before retrying. Do not delete the archive until you have a backup.

Local rehearsal (no credentials; add `--geocode` or `--maps <link>` to try locations, which uses the network):

```sh
pnpm photos:ingest -- ./my-photos --album landscapes --tags landscape,sunset --dry-run --out .photos-output
pnpm test:photos
```

The rehearsal still creates draft YAML entries; derivatives go to the ignored output directory.
R2 upload mode is optional locally and requires the same environment variables. Public keys use
`<filename-slug>/<content-hash>/<width>.<avif|webp>` with immutable one-year caching; changing
an original changes its key. Only derivatives reach the public bucket. The ingest workflow has
no automatic trigger; review and merge the generated PR yourself.

### Now page (`/now/`)

A [now page](https://nownownow.com/about) about what you're focused on at the moment. It is
**unlisted** (noindex, not linked) until you announce it. Edit `src/content/now/now.md` or
*Pages → Now* in `/admin`: set `updated` and `location`, write the sections in Markdown, and turn
off `placeholder` to remove the draft banner.

### Uses page (`/uses/`)

A [uses page](https://uses.tech) listing your hardware, software and camera gear. It is also
**unlisted**. Edit `src/content/uses/uses.md` or *Pages → Uses* in `/admin`, replace the TODO
items, and turn off `placeholder`.

## Testing and quality

| Check | Command |
| --- | --- |
| Types | `pnpm check` |
| Build contracts (SEO, theme, links) | `pnpm verify` |
| Browser and accessibility (WCAG 2.1 AA via axe) | `pnpm test:e2e` |
| Visual regression (separate baselines) | `pnpm test:visual` |
| CMS sign-in Worker | `pnpm test:cms-auth` |
| View counter Worker | `pnpm test:views` |
| Photography helpers and offline ingest | `pnpm test:photos` |
| Photo originals/catalogue privacy | `pnpm check:photos` |
| Photo ingest (offline rehearsal) | `pnpm photos:ingest -- <files-or-dirs> --dry-run --out .photos-output` |
| Dependencies | `pnpm audit` |

### Visual regression

Build first, then run `pnpm test:visual`. Twenty viewport snapshots cover home (after
its deferred terminal fragment loads), resume, a blog post, projects and 404, in terminal/light
and desktop/mobile. Animations/carets are disabled, fonts/images are awaited, and random homepage
copy/glyphs, dates and build metadata are masked. Pixel differences have a 1% budget.
Regular `pnpm test:e2e` never requires snapshots.

**CI truth is Ubuntu + Google Chrome**, shared by the visual gate and **Update visual baselines**
(`.github/workflows/visual-baselines.yml`). Snapshots live in
`tests/e2e/__screenshots__/{platform}/{project}/`; never substitute macOS or Chromium
images for Linux/Chrome. Missing Linux images skip individually with a workflow notice; existing
images are still checked, and failures upload the `visual-diffs` artifact.

**One-time bootstrap / intentional UI updates:** once this workflow exists on the default branch,
open Actions → Update visual baselines → Run workflow and select the target branch. It builds,
generates all Linux PNGs, verifies a second run, and commits them back with `GITHUB_TOKEN`
(`contents: write`). Review the committed images before merging. Protected branches may
reject the push: use a writable feature branch. Token-created commits do not trigger CI, so then
manually run **Portfolio Quality** on that branch. The workflow never accepts fork code with a
write token. Chrome/Ubuntu upgrades may also require reviewed baseline refreshes.

For disposable local checks on macOS, use `pnpm test:visual --update-snapshots` and then
`pnpm test:visual` (set `PLAYWRIGHT_CHANNEL=chrome` for installed Chrome). Darwin
snapshots are ignored by Git and are not CI baselines.

### Lighthouse

Build first, then run `pnpm lighthouse` (mobile) or `LIGHTHOUSE_DESKTOP=1 pnpm lighthouse`
(desktop). You need Chrome installed; set `CHROME_PATH` to use another Chromium.

- Six routes are audited three times per profile.
- Accessibility, Best Practices and SEO must score 100.
- Performance must score at least 95, to absorb CI timing noise. Local medians are 100.
- Reports go to `.lighthouseci/reports/` locally, or to CI artifacts.

Latest local medians, measured 2026-10-27 (Performance / Accessibility / Best Practices / SEO):

| Route | Mobile | Desktop |
| --- | --- | --- |
| `/`, `/about/`, `/projects/`, `/contact/`, `/resume/` | 100/100/100/100 | 100/100/100/100 |
| `/project/webDev/weather-app/` | 100/100/100/100 | 100/100/100/100 |

### Security headers and CSP

`public/_headers` is the response-header source of truth; run `pnpm sync:headers` after edits
so Vercel serves identical headers. `pnpm verify` rejects drift and checks every built HTML file.

The `HTML-CSP` comment in that file supplies the script policy. An Astro build hook injects it
after the charset and before scripts/styles in every non-admin head, with SHA-256 hashes of inline
scripts, including the blocking pre-paint theme bootstrap. A build-wide allowlist keeps one stable
policy across pages and deferred terminal content; JSON-LD is inert data, not executable script.
Navigation uses full page loads with native view transitions (no ClientRouter), so the theme
bootstrap runs before first paint on every page.
The response policy deliberately omits `default-src`/`script-src`: a second policy without the
build hashes would block scripts even when the meta allows them. The meta supplies both, plus
all resource restrictions; header-only `frame-ancestors` remains in the response. Scripts have
no `unsafe-inline` or `unsafe-eval`; `script-src-attr 'none'` forbids event handlers.

`style-src 'unsafe-inline'` remains necessary for Shiki/other inline style attributes, Astro
scoped styles and the resume print popup's inherited policy. Removing it would break rendering;
script hashes do not authorize style attributes. The separate Sveltia `/admin/` CSP is unchanged.

Build output marks scripts `data-cfasync="false"` to bypass Rocket Loader. `Cache-Control:
no-transform` prevents Cloudflare email obfuscation and automatic analytics injection from
rewriting HTML; keep edge HTML/script rewriting disabled (including future minifiers).
The explicit, privacy-aware `Analytics.astro` loader is allowed. No remote settings are changed.

Preview/Lighthouse do not apply response headers, but **do** enforce the built meta CSP.
Playwright additionally injects the response CSP from `public/_headers` and checks violation
events/console errors through navigation, themes, photography, resume exports and print.

## CI/CD and deployment

**Portfolio Quality** (`ci.yml`) runs its checks in parallel and stops at the first failure:

1. **At once:** Conventions (PRs only: PR title and commit messages), CodeQL, Build (audit, type
   check, build, SEO/theme/link/header checks) and Node 24.
2. **As soon as Build is done:** E2E (Playwright + axe), Visual regression (both on the runner's
   Chrome) and Lighthouse (mobile and desktop, each split into two URL shards).
3. **Deploy**, once every check has passed: GitHub Pages on `main`, plus Cloudflare Pages and Vercel
   once their secrets are set.

If any check fails, it cancels the rest of the run, so failures don't waste minutes.
It runs on PRs and on pushes to `main`. A new push cancels the older PR run.

Other workflows:

- **Update visual baselines** (`visual-baselines.yml`): manual Ubuntu/Chrome snapshot refresh; see Testing.
- **CMS Auth Worker** (`cms-auth.yml`): tests and deploys `workers/cms-auth/`.
- **Views Worker** (`views.yml`): tests `workers/views/`, applies its D1 migrations and deploys it.
- **Photo ingest** (`photos.yml`): manual; publishes R2 inbox photos and opens a draft metadata PR.
- **Locate photos** (`photos-locate.yml`): on photo PRs, resolves Maps links and place names.
- **Release** (`release.yml`): Release Please versioning, changelog, tags and GitHub releases.
- **Deploy** (`deploy.yml`): manual redeploy to GitHub Pages or Google Cloud Storage.

| Target | Secrets / variables |
| --- | --- |
| Cloudflare Pages | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, optional var `CLOUDFLARE_PAGES_PROJECT` |
| Vercel | `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` |
| Google Cloud Storage | `GCP_WORKFLOW_ID_PROVIDER_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GCLOUD_BUCKET` |

Once CI deploys to Cloudflare and Vercel, turn off their own Git auto-deploys. Otherwise they build
every push without the gates.

**Analytics.** Set the repository variable `CF_BEACON_TOKEN` to a Cloudflare Web Analytics site
token and CI builds it in as `PUBLIC_CF_BEACON_TOKEN`. That turns on cookieless, privacy-friendly
page-view counts, viewable in the Cloudflare dashboard. The beacon only loads on `amrithnath.dev`,
never on previews or localhost, and is skipped for visitors who send Global Privacy Control or Do
Not Track. Leave the variable unset to ship no analytics. Don't also enable Cloudflare Pages' own
analytics injection, or page views are counted twice.

### View counts

Blog posts and projects can show `views: 123` under the description. The count comes from
`workers/views/`, a Cloudflare Worker with a D1 table of `path → count` at
`views.amrithnath.dev`. `GET /views?path=/blog/x/` reads a count; `POST /views` with
`{"path":"/blog/x/"}` adds one.

- Only `/blog/…/` and `/project/…/` paths (max 160 characters) are accepted. New rows are created
  only for pages that return 200 on `SITE_URL`.
- CORS is limited to the exact origins in `ALLOWED_ORIGINS` (`workers/views/wrangler.toml`). No
  cookies; IP, user agent and referrer are never read or stored.
- Each browser counts a page once (a `localStorage` flag), only on `amrithnath.dev`. Previews and
  localhost only read. `Sec-GPC: 1` / `DNT: 1` visitors are never counted, by the page or the Worker.
- The site renders the counter only when `PUBLIC_VIEWS_URL` is set at build time. Otherwise there
  is no markup, script or request.

**One-time setup**

1. Create the database: `npx wrangler d1 create portfolio-views`, and note its `database_id`.
2. Make sure the `CLOUDFLARE_API_TOKEN` secret (see the CMS setup) also has **D1: Edit**
   (account). `CLOUDFLARE_ACCOUNT_ID` is reused.
3. Add repository variables `VIEWS_D1_DATABASE_ID=<database_id>` and
   `VIEWS_URL=https://views.amrithnath.dev`.
4. Run the **Views Worker** workflow. It applies `workers/views/migrations/`, deploys the Worker
   and creates the `views.amrithnath.dev` custom domain (DNS record included).
5. Rebuild the site (push to `main` or rerun **Portfolio Quality**) so `VIEWS_URL` is built in.

The CSP already allows `https://views.amrithnath.dev` in `connect-src`. To use another host,
update `public/_headers` (then `pnpm sync:headers`), `wrangler.toml` and `VIEWS_URL`.

## Search and AI discovery

`/search/?q=Bluetooth` is an unlisted, browser-side site search. `pnpm build` runs Pagefind
after Astro and writes `dist/pagefind/`; use `pnpm preview` to test it (the dev server has no
index). Queries and index requests stay on this site, with no external search service, cookies,
or credentials; the search page also omits analytics. Only public, indexable main content is indexed: unlisted photography, now, search,
admin, fragments, redirects and offline pages are excluded. Search supports both themes and
keyboard use; its WebAssembly CSP exception is scoped to `/search/*`. No owner setup is needed.

The canonical origin is `https://amrithnath.dev`. Everything below is generated at build time.

- `src/components/SEO.astro` emits canonical and social metadata and schema.org JSON-LD.
- `/llms.txt` and `/llms-full.txt` list the pages, the Markdown mirrors and `/rss.xml`.
- Markdown mirrors such as `/about.md`, `/resume.md` and the post mirrors provide plain-text
  versions of each page.
- `/robots.txt` welcomes search and AI crawlers. It excludes the wedding, admin, API, fragment,
  WIP and unlisted paths. Robots rules are guidance, not access control.
- The sitemap leaves out private, noindex and redirect routes.

Route exclusions live in `src/lib/seo.ts`. Add new private or unlisted pages there, and keep
unlisted pages out of `TerminalNav.astro` and `src/data/navigation.ts` until they launch. Keep profile facts in
`src/data/resume-compendium.ts` rather than duplicating them. Check the output with
`pnpm build && pnpm check:seo`.

## Themes

Choose **auto**, **dark**, or **light** from the terminal statusline's
`:set background=` buttons (click or Tab + Enter/Space; no commands to type).
Light uses warm paper surfaces and high-contrast ink colors; dark keeps the original
terminal palette. Auto follows your system color scheme live and is the first-visit
default. Explicit choices persist across reloads, navigation, and tabs; selecting auto
clears the stored choice. Without JavaScript, the site stays dark and hides the switcher.

To add a theme, register it in `src/themes/index.ts`, define every scoped palette
token, and import its CSS in `BaseHead.astro`. Content is rendered once for all themes.
See [the theme guide](src/themes/README.md).

## Contributing and releases

1. Branch from `main`, make the change, and run `pnpm check`, `pnpm verify` and `pnpm test:e2e`.
2. Use Conventional Commits that start the subject with an emoji, e.g. `feat: ✨ add a feature` or
   `fix: 🐛 fix a bug`. See [AGENTS.md](AGENTS.md#versioning-and-releases) for the emoji list.
3. Open a pull request; CI must pass before merging.

Release Please turns merged commits into a release PR. Merging that PR updates `CHANGELOG.md`,
tags `vX.Y.Z` and publishes a GitHub release. The site footer and `/version.json` show the
current version.

## License

| What | License |
| --- | --- |
| Source code | [Apache License 2.0](LICENSE) |
| Blog posts (`src/content/blog/`) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| Profile, résumé, project write-ups, photos | © Amrithnath Vijayakumar, all rights reserved |

Fork the code freely, but replace the personal content with your own.
Third-party attributions (Sveltia CMS Authenticator, MIT; Fira Code, OFL 1.1) are listed in [NOTICE](NOTICE).
