# Changelog

## [2.2.0](https://github.com/Amrithnath/Astro-portfolio/compare/v2.1.0...v2.2.0) (2026-10-28)


### ✨ Features

* ✨ add light theme with terminal-style switcher ([b344f07](https://github.com/Amrithnath/Astro-portfolio/commit/b344f079098fcdc58e7164d141c67de4aec5d0dc))
* ✨ add privacy-friendly Cloudflare Web Analytics ([3315b1c](https://github.com/Amrithnath/Astro-portfolio/commit/3315b1cdc10d41916076ee4d56aa520a783d5f1b))
* ✨ photo albums, light theme, richer OG cards and private analytics ([b92fc8f](https://github.com/Amrithnath/Astro-portfolio/commit/b92fc8f84e86c7d6797dcdc947230de0b166b6d2))
* **photos:** ✨ add tagged galleries, trips and private R2 ingest ([128d4e7](https://github.com/Amrithnath/Astro-portfolio/commit/128d4e7d14a35baf05eb5f56d05aaa19ad26501e))
* **projects:** ✨ richer OG cards, project write-ups and tech filters ([27f193c](https://github.com/Amrithnath/Astro-portfolio/commit/27f193cd93b1670f6d0a8547de7cd42f10173eb8))

## [2.1.0](https://github.com/Amrithnath/Astro-portfolio/compare/v2.0.0...v2.1.0) (2026-10-28)


### ✨ Features

* ✨ add unlisted photography gallery ([68cb631](https://github.com/Amrithnath/Astro-portfolio/commit/68cb631494340c73eaf396e43c602c39eb8ff458))
* ✨ unlisted photography gallery, Vercel security headers and CI upgrades ([59922ee](https://github.com/Amrithnath/Astro-portfolio/commit/59922eeda468cd158d900a1a8c0df0f5dfc0cd98))
* **cms:** ✨ add blog editor, Apache 2.0 license, and README refresh ([dbd4c9c](https://github.com/Amrithnath/Astro-portfolio/commit/dbd4c9c903eff8f376136f2960b3fa85b22c4790))
* **cms:** ✨ add hardened GitHub sign-in worker for the blog editor ([e932ca6](https://github.com/Amrithnath/Astro-portfolio/commit/e932ca686fe683c5dbdc66cb42ca99f17a894a33))
* **cms:** ✨ add Sveltia CMS blog editor at /admin ([3040bb7](https://github.com/Amrithnath/Astro-portfolio/commit/3040bb742ad2d07595c28c7a874e04e9d53ddae4))


### 🐛 Bug Fixes

* 🐛 show license and blog link in blog post footers ([d91d5db](https://github.com/Amrithnath/Astro-portfolio/commit/d91d5dbce2df1d5afe65248f6e5cfd561cd8ad0c))
* **release:** 🐛 configure the root package for Release Please ([3f017c8](https://github.com/Amrithnath/Astro-portfolio/commit/3f017c8bbf4984d33c343869d5f660d4504ee689))
* **release:** 🐛 configure the root package for Release Please ([516987a](https://github.com/Amrithnath/Astro-portfolio/commit/516987a5a3c645ba607ddbb9f7585ec9c64385dd))
* **security:** 🔒 patch vulnerable dependencies in archived wedding projects ([d902b97](https://github.com/Amrithnath/Astro-portfolio/commit/d902b97cc8b41335152ed57a1af3403cb90e5184))
* **security:** 🔒 serve security headers on Vercel deployments ([9ab663e](https://github.com/Amrithnath/Astro-portfolio/commit/9ab663eeecec62536c03e9bc20ec8e3334a022b4))


### 📝 Documentation

* 📝 license blog posts under CC BY 4.0 and reserve profile content ([7f67eb2](https://github.com/Amrithnath/Astro-portfolio/commit/7f67eb2b27e07824ee4d8a41bf4683ce1de8bff4))
* 📝 restructure README and fix badges ([478b2f2](https://github.com/Amrithnath/Astro-portfolio/commit/478b2f2d0bd56799cacd33bc314b55584fc0c042))


### 👷 CI

* 👷 deploy CMS auth worker and accept CMS pull requests ([81c8e5e](https://github.com/Amrithnath/Astro-portfolio/commit/81c8e5e0d202324630bbc27a0fff865f8a313bcf))
* 👷 move actions to Node 24 majors, shard Lighthouse, add Dependabot ([7bba405](https://github.com/Amrithnath/Astro-portfolio/commit/7bba405ae8d43142574a2bf4ba2ca7c56f06899e))
* 👷 run e2e tests on the runner's preinstalled Chrome ([9e110e0](https://github.com/Amrithnath/Astro-portfolio/commit/9e110e0ba182630c2b667535b04f4c6d2b86d4c0))
* 👷 run quality gates in parallel and cancel the run on first failure ([33a799d](https://github.com/Amrithnath/Astro-portfolio/commit/33a799def433477830968cd98bf71ba1b2d2dfbf))

## [2.0.0](https://github.com/Amrithnath/Astro-portfolio/compare/f61943e^...v2.0.0) (2026-10-27)

### ✨ Features

- Add typed blog and project content collections, published-content filtering, and RSS feed.
- Introduce the terminal theme registry and shared single-render shell; refresh professional profile with the IBM/HashiCorp platform engineering role and Go-first skills.
- Add crawler discovery files, Markdown mirrors, canonical metadata, and structured profile data.
- Add build-time Open Graph images, social preview metadata, and page view transitions.
- Improve keyboard accessibility with skip navigation, visible focus behavior, and reduced-motion support.
- Make the resume CLI the default and reveal the visual generator on request.

### 🐛 Bug Fixes

- Correct resume and terminal output formatting, display dates consistently, and ensure only one cursor renders per page.
- Exclude redirects, offline fallback, and terminal-only content from crawling and SEO checks.
- Escape echoed resume CLI input before rendering, with browser smoke coverage for the XSS regression.

### 🔒 Security

- Add production security headers and harden the service worker's cache, navigation, and request handling.
- Require supported Node versions and address Astro 7 compatibility and dependency advisories.

### ⚡ Performance

- Cache content-hashed assets immutably and use versioned service-worker caches with network-first navigation.
- Streamline shared UI styles and terminal rendering around reusable components.

### ♻️ Refactoring

- Consolidate portfolio views into one extensible terminal shell and token-based styling system.
- Move blog and project content to typed collections while retaining stable route IDs.

### 📝 Documentation

- Document the shared styling system, theme tokens, and component primitives.
- Refresh the profile summary and current role information.

### 👷 CI

- Add `astro check`, Playwright browser smoke tests, and a pull-request quality workflow.
- Align build tooling with the Astro 7 Node runtime requirements.

### 📦 Build

- Upgrade to Astro 7, migrate removed APIs, and resolve supported Vite configuration and compiler compatibility.

## 1.x and earlier

Earlier portfolio history is not individually itemized here; see the repository history for prior changes.
