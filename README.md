# 🚀 Astro Portfolio

![Deploy Status](https://img.shields.io/github/actions/workflow/status/Amrithnath/Astro-portfolio/deploy.yml?branch=main&label=deploy)
![Tests](https://img.shields.io/github/actions/workflow/status/Amrithnath/Astro-portfolio/lint.yml?branch=main&label=tests)
![Quality Tests](https://img.shields.io/github/actions/workflow/status/Amrithnath/Astro-portfolio/test.yml?branch=main&label=quality)
![GitHub](https://img.shields.io/github/license/Amrithnath/Astro-portfolio)
![Node.js Version](https://img.shields.io/badge/node-%3E%3D22.23.4-brightgreen)
![Package Manager](https://img.shields.io/badge/package%20manager-pnpm-orange)
![Lighthouse](https://img.shields.io/badge/Lighthouse-4×100-brightgreen)

A modern, responsive portfolio website built with [Astro](https://astro.build/). This portfolio showcases projects, skills, and experience with excellent performance and SEO optimization.

## ✨ Features

- ⚡ **Lightning Fast**: Built with Astro for optimal performance (4×100 Lighthouse locally)
- 📱 **Responsive Design**: Looks great on all devices
- 🎨 **Terminal UI**: One accessible content tree with a token-based, extensible theme registry
- 🔍 **SEO Optimized**: Built-in SEO best practices
- 🚀 **Easy Deployment**: Multiple deployment options (GitHub Pages, GCP)
- 🔧 **Type Safe**: Full TypeScript support
- 🧪 **Comprehensive Testing**: Automated quality assurance
- ♿ **Accessibility**: WCAG compliance testing

## Themes

Only the terminal theme is enabled. Pages render content once, with a shared head and
pre-paint validated theme initialization (including legacy preference migration).
To add a theme, register it in `src/themes/index.ts`, add scoped CSS tokens, import the
stylesheet in `BaseHead.astro`, and optionally expose `window.__theme.set(id)` through
a switcher when multiple themes exist. See [the theme guide](src/themes/README.md).
The standalone public offline page stays terminal-only; wedding has its own styling.

## 🛠️ Tech Stack

- **Framework**: [Astro](https://astro.build/)
- **Language**: TypeScript
- **Styling**: CSS with LightningCSS
- **Font**: Fira Code
- **Code Quality**: Prettier + TypeScript
- **Deployment**: GitHub Pages / Google Cloud Storage
- **CI/CD**: GitHub Actions

## 🚀 Getting Started

### Prerequisites

- Node.js 22.23.4+ (CI tests 22.23.4 and 24)
- pnpm 8 (lockfile format 6; matches CI)

TypeScript remains on the latest 5.x release (5.9.3). TypeScript 6.0.3 and 7.0.2
enable stricter defaults that introduce nullability errors in the existing resume data;
upgrading that data model is deferred rather than weakening compiler checks.

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Amrithnath/Astro-portfolio.git
   cd Astro-portfolio
   ```

2. Install dependencies:
   ```bash
   pnpm install --frozen-lockfile
   ```

3. Start the development server:
   ```bash
   pnpm dev
   ```

4. Open [http://localhost:4321](http://localhost:4321) in your browser

## 📚 Available Scripts

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start development server |
| `pnpm build` | Build for production |
| `pnpm preview` | Preview production build locally |

## Lighthouse

Build first with `pnpm build`, then run `pnpm lighthouse` for default mobile
emulation and `LIGHTHOUSE_DESKTOP=1 pnpm lighthouse` for desktop. The pinned
`@lhci/cli@0.15.1` runs through `pnpm dlx`, without adding project dependencies.
Chrome must be installed; set `CHROME_PATH` to select another Chromium executable.

The `lighthouse` CI matrix audits all six routes three times per profile. Accessibility, Best Practices and SEO
require median scores of **100**; Performance requires **95** (all failures are
errors). The 95 Performance budget absorbs CI timing variance; local medians
are 100. JSON/HTML
reports are uploaded as `lighthouse-mobile` and `lighthouse-desktop` artifacts;
local reports live in `.lighthouseci/reports/` (ignored by Git).

### Local measurements

Measured on 2026-10-27 using headless Chrome 156: baseline Lighthouse 12.8.2,
final Lighthouse CI 0.15.1 (Lighthouse 12.6.1). Baselines are one run per route/profile;
finals are three-run category medians. Values are **Performance / Accessibility /
Best Practices / SEO**, not a claim about a hosted production deployment.

| Route | Mobile before | Mobile after | Desktop before | Desktop after |
| --- | --- | --- | --- | --- |
| `/` | 99/100/100/100 | 100/100/100/100 | 100/100/100/100 | 100/100/100/100 |
| `/about/` | 99/100/100/100 | 100/100/100/100 | 100/100/100/100 | 100/100/100/100 |
| `/projects/` | 100/100/100/100 | 100/100/100/100 | 100/100/100/100 | 100/100/100/100 |
| `/contact/` | 100/100/100/100 | 100/100/100/100 | 100/100/100/100 | 100/100/100/100 |
| `/resume/` | 100/100/100/100 | 100/100/100/100 | 100/100/100/100 | 100/100/100/100 |
| `/project/webDev/weather-app/` | 99/100/100/100 | 100/100/100/100 | 100/100/100/100 | 100/100/100/100 |

Every non-perfect baseline audit was recorded:

- `first-contentful-paint`: all mobile routes, 1.4–1.5 s.
- `largest-contentful-paint`: mobile home, about and article, 1.7 s.
- `render-blocking-resources`: all mobile routes and desktop resume,
  estimated savings 120–600 ms.
- `render-blocking-insight`: all route/profile pairs, mobile savings 450–600 ms.
- `network-dependency-tree-insight`: all route/profile pairs.
- `uses-responsive-images`: article on both profiles, savings 23–24 KiB.
- `image-delivery-insight`: article on both profiles, savings 23–29 KiB.
- `lcp-discovery-insight`: article on both profiles, missing high fetch priority.

Critical CSS is now inline, the two local text font weights are preloaded, and
article hero images have responsive AVIF candidates and high fetch priority.
Scrollable JSON, directory trees and resume output have named keyboard-accessible
regions, with mobile keyboard regression tests. Informational dependency-chain
and timing diagnostics can remain even when all category scores are 100.

`astro preview` and Lighthouse CI's static server do **not** apply Cloudflare
`public/_headers`. CSP/HSTS and related header diagnostics are therefore not
production-header verification; the existing CSP is unchanged. Production scores
must be measured separately, especially when Cloudflare injects analytics/scripts.
Intentionally noindex redirect/WIP routes are outside this budget. Lighthouse 100
is not a substitute for a complete accessibility or security audit.

## 📁 Project Structure

```
├── src/
│   ├── components/     # Reusable components
│   ├── layouts/        # Page layouts
│   ├── pages/          # Page routes
│   ├── styles/         # Global styles
│   ├── data/           # Static data
│   └── assets/         # Static assets
├── public/             # Public assets
├── .github/workflows/  # CI/CD workflows
└── dist/               # Built site (generated)
```

## 🧪 Testing & Quality Assurance

This project includes comprehensive testing and quality checks:

### Automated Tests
- **Build Validation**: Ensures successful builds
- **Security Audits**: Dependency vulnerability scanning
- **Performance**: Bundle size analysis
- **Accessibility**: axe-core accessibility testing
- **Link Validation**: Broken link detection

### CI/CD Workflows
- **Lint and Test**: Basic build and security checks on every push/PR
- **Build and Quality Tests**: Comprehensive build validation and performance analysis
- **Deploy**: Automated deployment to GitHub Pages and GCP
- **Badge Updates**: Status badge maintenance

## 🚢 Deployment

This project supports multiple deployment options:

### GitHub Pages (Default)
Automatically deploys to GitHub Pages on push to `main` branch after all tests pass.

### Google Cloud Storage
Configure the following repository secrets and variables:
- `GCP_WORKFLOW_ID_PROVIDER_ID`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL` 
- `GCLOUD_BUCKET`

### Manual Deployment
You can manually trigger deployments using the GitHub Actions interface.

## 🔧 Customization

1. **Personal Information**: Update content in `src/data/`
2. **Styling**: Modify styles in `src/styles/`
3. **Components**: Add/edit components in `src/components/`
4. **Pages**: Create new pages in `src/pages/`

## 🏗️ Development Workflow

1. Create a feature branch from `main`
2. Make your changes
3. Test locally: `pnpm build` and `pnpm preview`
4. Commit and push your changes
5. Create a Pull Request
6. Automated tests will run
7. Merge after approval and passing tests

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📞 Contact

- Portfolio: [Your Live Site URL]
- Email: [Your Email]
- LinkedIn: [Your LinkedIn]
- GitHub: [@Amrithnath](https://github.com/Amrithnath)

---

⭐ Star this repository if you found it helpful!

[Edit on StackBlitz ⚡️](https://stackblitz.com/edit/github-tfldar)


<!-- add the line for the badges from the linter -->




## AI crawler and search discovery

The canonical origin is `https://amrithnath.dev` (`site` in `astro.config.mjs`). All discovery
files are generated by Astro at build time; there is no server runtime or JavaScript requirement
for reading the profile:

- `/llms.txt` links the public pages, Markdown mirrors, `/llms-full.txt` (complete profile and article notes), and `/rss.xml` (blog RSS).
- `/index.md`, `/about.md`, `/resume.md`, `/projects.md`, and Markdown versions of blog/project
  posts expose readable text. Post mirrors use the original Markdown; profile mirrors use
  `src/data/resume-compendium.ts`, also used by the resume generator.
- `src/components/SEO.astro` emits canonical/social metadata, safely serialized schema.org
  entity/page data, and alternate links to the LLM index and available Markdown mirrors.
- Home, about, and resume include an expandable semantic profile in their initial HTML. It remains
  usable without JavaScript; the homepage's deferred terminal fragment and generator still work.
- `/robots.txt` welcomes search, AI training, search-agent, and user-fetch crawlers, repeating
  private-route exclusions for each agent. Wedding/photography, admin, API, fragment, and WIP
  paths are excluded. Robots rules are crawler guidance, **not access control**.
- The official `@astrojs/sitemap` integration generates the HTML sitemap for this Astro 7 static
  site. It excludes private, noindex, redirect, and non-HTML routes; RSS is advertised separately.

Shared exclusions and entity helpers live in `src/lib/seo.ts`; update its route policy when
adding private/noindex pages. Keep new profile facts in the compendium, rather than duplicating
SEO data. Pages may pass title, description, image, and noindex overrides to their layout.
The default social image is the existing 512px portfolio favicon; posts use their frontmatter
image. Wedding pages and their existing head component are deliberately not changed.

Validate generated output with:

```bash
pnpm build
node scripts/check-agentic-seo.mjs
```

`llms.txt`/Markdown improve machine readability but cannot guarantee crawler adoption or citations.
Cloudflare bot/WAF policies must separately permit the desired crawlers; robots.txt cannot override
host-level blocking. Theme-only refactors should retain the SEO component and static text fallback.


## Adding blog posts and projects

Content Layer collections are defined with Zod schemas in `src/content.config.ts`.
Add blog Markdown to `src/content/blog/` and project Markdown to `src/content/projects/`:

```yaml
---
title: My post
description: A short summary.
pubDate: 2026-10-27
updatedDate: 2026-10-28 # optional
tags: [Astro]
draft: false
---
```

Do not include `layout:`. Optional article fields: `img` or `image` (absolute image URL),
and `lang`. Projects also support optional `link`, `client`, `github`, `live`, `demo`, and
`tech` (string array). Omitted `tags` defaults to `[]`; omitted `draft` defaults to `false`.
File paths preserve case and subfolders: `projects/webDev/weather-app.md` publishes at
`/project/webDev/weather-app/`. Drafts are visible in development only; production builds
exclude them from routes, lists, mirrors, LLM discovery, sitemap, and RSS. Published blog
posts automatically appear in `/rss.xml`; blog and project Markdown mirrors and LLM notes
are also generated from the collections. The profile compendium is still maintained separately.
