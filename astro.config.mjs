import { defineConfig } from 'astro/config';

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
