const desktop = process.env.LIGHTHOUSE_DESKTOP === '1';

module.exports = {
  ci: {
    collect: {
      staticDistDir: './dist',
      url: [
        '/',
        '/about/',
        '/projects/',
        '/contact/',
        '/resume/',
        '/project/webDev/weather-app/',
      ],
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
      outputDir: `.lighthouseci/reports/${desktop ? 'desktop' : 'mobile'}`,
    },
  },
};
