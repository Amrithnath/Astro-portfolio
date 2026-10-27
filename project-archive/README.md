# Project archive

Paused projects kept for later. Nothing here is built, tested, or deployed with the portfolio.

## Wedding upload stack

| Path | What it is |
| --- | --- |
| `site/src/pages/wedding.astro` | Public `/wedding` upload page |
| `site/src/components/MainHead.astro` | Head component used only by the wedding page |
| `wedding-upload-server/` | Node/Express upload server (Google Drive) |
| `wedding-api/` | Go API (chi, gRPC gateway, Postgres) |
| `admin-ui/` | Astro admin UI for the API |
| `proto/`, `buf.yaml`, `buf.gen.yaml` | API protobuf definitions |
| `infra/terraform/` | Cloud Run and R2 infrastructure |

Each package has its own lockfile and is installed on its own, e.g.
`pnpm --dir project-archive/admin-ui install`. Root scripts such as `pnpm wedding:api`,
`pnpm admin:dev`, `pnpm api:go` and `pnpm proto:generate` point here.

Known gap: `wedding-api` needs `pnpm proto:generate` and a newer `google.golang.org/grpc`
before it builds again.

## Restoring the wedding page

1. Move `site/src/pages/wedding.astro` to `src/pages/` and `site/src/components/MainHead.astro`
   to `src/components/`.
2. Uncomment the `/api` proxy in `astro.config.mjs` and the `/wedding/*` block in
   `public/_headers`.
3. `/wedding` stays out of the sitemap and robots via `src/lib/seo.ts`.
