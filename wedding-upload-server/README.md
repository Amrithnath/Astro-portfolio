# Wedding Upload Server

Standalone Express middleware for the static Astro `/wedding` route. The Astro frontend sends relative `/api/*` requests, so local development and production should proxy `/api` to this server.

## Setup

1. Copy `.env.example` to `.env`.
2. Set `ALLOWED_ORIGIN` to the exact live origin of the Astro site, for example `https://portfolio.example.com`.
3. Set `GOOGLE_APPLICATION_CREDENTIALS` to the absolute path of your Google Cloud service account JSON file.
4. Share the target Google Drive folder with the service account email address and grant it **Editor** access. If you skip this, Google Drive upload initiation will fail with `404` even when the folder ID is correct.

## Local Development

Install dependencies:

```bash
pnpm install
```

Start the server:

```bash
pnpm dev
```

The Astro site is configured to proxy `/api/*` to `http://127.0.0.1:8787` in local dev and preview.

## Production Proxying

Because the Astro frontend calls relative `/api` paths, production hosting must reverse-proxy `/api/*` to this Express service. Keep the public URL same-origin when possible; that avoids cross-origin upload issues and reduces CORS surface area.

Example reverse proxy shape:

```nginx
location /api/ {
  proxy_pass http://127.0.0.1:8787;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

If your host cannot proxy `/api`, switch the frontend to an explicit public API base URL instead of relative paths.

## Folder Sharing Checklist

- Open the destination Google Drive folder.
- Click **Share**.
- Paste the service account email from the JSON credentials file.
- Set the permission to **Editor**.
- Do not make the folder public.

## Notes

- The server keeps Google resumable session URIs on the backend and returns opaque `uploadId` values to the browser instead.
- Upload session state is in-memory, which is fine for a single deployment instance. If you later scale to multiple instances, move upload session tracking into shared storage.
