import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { isIndexablePath } from './src/lib/seo';

const weddingApiTarget = process.env.WEDDING_API_URL || 'http://127.0.0.1:8787';

// https://astro.build/config
export default defineConfig({
  site: 'https://amrithnath.dev',
  integrations: [sitemap({ filter: page => isIndexablePath(new URL(page).pathname) })],
  output: 'static',
  build: {
    inlineStylesheets: 'auto',
    assets: '_astro'
  },
  image: {
    service: {
      entrypoint: 'astro/assets/services/sharp'
    },
    remotePatterns: [{ protocol: "https" }],
  },
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'viewport'
  },
  compressHTML: true,
  vite: {
    server: {
      proxy: {
        '/api': {
          target: weddingApiTarget,
          changeOrigin: true,
        },
      },
    },
    preview: {
      proxy: {
        '/api': {
          target: weddingApiTarget,
          changeOrigin: true,
        },
      },
    },
    build: {
      cssMinify: 'lightningcss'
    }
  }
});
