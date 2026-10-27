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
| `pnpm verify` | Build, then check SEO output, the theme system and internal links |
| `pnpm test:e2e` | Playwright smoke and accessibility tests (run after a build) |
| `pnpm test:cms-auth` | Unit tests for the CMS sign-in Worker |
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
├── scripts/             # Build output checks
├── tests/e2e/           # Playwright tests
└── .github/workflows/   # CI, releases and deploys
```

Paused projects, such as the wedding upload stack, live in [`project-archive/`](project-archive/README.md).

## Writing content

### Markdown

Blog posts live in `src/content/blog/` and projects in `src/content/projects/`. The schemas are in
`src/content.config.ts`.

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

- Optional fields: `img` or `image`, and `lang`. Projects also accept `link`, `client`, `github`,
  `live`, `demo` and `tech`.
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

## Testing and quality

| Check | Command |
| --- | --- |
| Types | `pnpm check` |
| Build contracts (SEO, theme, links) | `pnpm verify` |
| Browser and accessibility (WCAG 2.1 AA via axe) | `pnpm test:e2e` |
| CMS sign-in Worker | `pnpm test:cms-auth` |
| Dependencies | `pnpm audit` |

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

The local servers don't apply Cloudflare's `public/_headers`, so header checks (CSP, HSTS) only
count on the deployed site.

## CI/CD and deployment

**Portfolio Quality** (`ci.yml`) runs its checks in parallel and stops at the first failure:

1. **At once:** Conventions (PRs only: PR title and commit messages), CodeQL, Build (audit, type
   check, build, SEO/theme/link checks) and Node 24.
2. **As soon as Build is done:** E2E (Playwright + axe on the runner's Chrome) and Lighthouse
   (mobile and desktop).
3. **Deploy**, once every check has passed: GitHub Pages on `main`, plus Cloudflare Pages and Vercel
   once their secrets are set.

If any check fails, it cancels the rest of the run, so failures don't waste minutes.
It runs on PRs and on pushes to `main`. A new push cancels the older PR run.

Other workflows:

- **CMS Auth Worker** (`cms-auth.yml`): tests and deploys `workers/cms-auth/`.
- **Release** (`release.yml`): Release Please versioning, changelog, tags and GitHub releases.
- **Deploy** (`deploy.yml`): manual redeploy to GitHub Pages or Google Cloud Storage.

| Target | Secrets / variables |
| --- | --- |
| Cloudflare Pages | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, optional var `CLOUDFLARE_PAGES_PROJECT` |
| Vercel | `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` |
| Google Cloud Storage | `GCP_WORKFLOW_ID_PROVIDER_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GCLOUD_BUCKET` |

Once CI deploys to Cloudflare and Vercel, turn off their own Git auto-deploys. Otherwise they build
every push without the gates.

## Search and AI discovery

The canonical origin is `https://amrithnath.dev`. Everything below is generated at build time.

- `src/components/SEO.astro` emits canonical and social metadata and schema.org JSON-LD.
- `/llms.txt` and `/llms-full.txt` list the pages, the Markdown mirrors and `/rss.xml`.
- Markdown mirrors such as `/about.md`, `/resume.md` and the post mirrors provide plain-text
  versions of each page.
- `/robots.txt` welcomes search and AI crawlers. It excludes the wedding, admin, API, fragment and
  WIP paths. Robots rules are guidance, not access control.
- The sitemap leaves out private, noindex and redirect routes.

Route exclusions live in `src/lib/seo.ts`. Add new private pages there. Keep profile facts in
`src/data/resume-compendium.ts` rather than duplicating them. Check the output with
`pnpm build && pnpm check:seo`.

## Themes

Only the terminal theme is enabled. To add one:

1. Register it in `src/themes/index.ts`.
2. Add scoped CSS tokens.
3. Import the stylesheet in `BaseHead.astro`.

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
