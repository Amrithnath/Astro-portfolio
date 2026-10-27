const desktop = process.env.LIGHTHOUSE_DESKTOP === '1';
// LIGHTHOUSE_SHARD="<index>/<total>" splits the URL list across parallel CI jobs.
const [shardIndex, shardTotal] = (process.env.LIGHTHOUSE_SHARD || '0/1').split('/').map(Number);
const urls = [
  '/',
  '/about/',
  '/projects/',
  '/contact/',
  '/resume/',
  '/project/webDev/weather-app/',
].filter((_, i) => i % shardTotal === shardIndex);
const reportName = `${desktop ? 'desktop' : 'mobile'}${shardTotal > 1 ? `-${shardIndex}` : ''}`;

module.exports = {
  ci: {
    collect: {
      staticDistDir: './dist',
      url: urls,
      numberOfRuns: 3,
      settings: {
        ...(desktop ? { preset: 'desktop' } : {}),
        chromeFlags: '--headless=new --no-sandbox',
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
      },
    },
    assert: {
      assertions: Object.fromEntries(
        ['performance', 'accessibility', 'best-practices', 'seo'].map(category => [
          `categories:${category}`,
          ['error', { minScore: category === 'performance' ? 0.95 : 1, aggregationMethod: 'median' }],
        ])
      ),
    },
    upload: {
      target: 'filesystem',
      outputDir: `.lighthouseci/reports/${reportName}`,
    },
  },
};
