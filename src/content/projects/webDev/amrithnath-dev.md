---
title: amrithnath.dev
link: https://amrithnath.dev
github: https://github.com/Amrithnath/Astro-portfolio
client: Self
pubDate: 2020-01-01 00:00:00
updatedDate: 2026-10-28 00:00:00
img: /images/projects/amrithnath-dev.webp
description: |
  This site. A terminal-themed Astro portfolio with a built-in privacy scanner, a live perf monitor and a carbon estimate, all running in your browser.
tech:
  - Astro
  - TypeScript
  - CSS
  - Cloudflare
  - GitHub Actions
status: active
featured: true
tags:
  - dev
---

You're looking at it. amrithnath.dev is a static [Astro](https://astro.build) site styled like a terminal, with professional and personal themes for people who'd rather not read monospace.

## Things to poke at

- **[Privacy scan](/privacy-check/)**: type `run check` to see what your browser reveals to every website. It checks ad blocking, Do Not Track and Global Privacy Control, fingerprinting surface, storage, WebRTC leaks and whether your browser is up to date. Everything runs locally and nothing is sent back to me.
- **Perf monitor**: on wide screens the right-hand pane shows how this page loaded for you, in plain language.
- **Carbon estimate**: the footer estimates the CO₂ from the data sent to you.

## How it's built

- Static output only, with no server code and no cookies.
- A strict Content Security Policy, checked in CI on every page.
- Automated checks for SEO, links, accessibility, CSP and visual regressions, plus Release Please for versioned releases.
- Hosted on Cloudflare.

The source is on [GitHub](https://github.com/Amrithnath/Astro-portfolio) under the Apache 2.0 license.
