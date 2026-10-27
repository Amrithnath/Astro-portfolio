# Changelog

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
