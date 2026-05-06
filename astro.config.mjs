import { defineConfig } from 'astro/config';

const weddingApiTarget = process.env.WEDDING_API_URL || 'http://127.0.0.1:8787';

// https://astro.build/config
export default defineConfig({
  site: 'https://your-portfolio-domain.com', // Replace with your actual domain
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
      cssMinify: 'lightningcss',
      rollupOptions: {
        output: {
          manualChunks: {
            'astro-runtime': ['astro/runtime']
          }
        }
      }
    },
    css: {
      lightningcss: {
        minify: true
      }
    }
  }
});
