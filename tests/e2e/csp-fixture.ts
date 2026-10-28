import { readFile } from 'node:fs/promises';
import { expect, test as base } from '@playwright/test';

// Preview ignores _headers. Apply the real response policy too, so both intersecting policies
// are exercised, including deferred fetches and the inherited about:blank print policy.
export const test = base.extend<{ cspGuard: void }>({
  cspGuard: [async ({ context }, use) => {
    const headers = await readFile(new URL('../../public/_headers', import.meta.url), 'utf8');
    const policy = headers.match(/^  Content-Security-Policy: (.+)$/m)![1];
    const adminPolicy = headers.split('/admin/*')[1].match(/^  Content-Security-Policy: (.+)$/m)![1];
    const violations: string[] = [];
    await context.exposeBinding('__reportCsp', (_source, violation: string) => violations.push(violation));
    await context.addInitScript(() => {
      document.addEventListener('securitypolicyviolation', event => {
        const report = (window as unknown as { __reportCsp: (message: string) => void }).__reportCsp;
        report(`${location.pathname}: ${event.effectiveDirective} ${event.blockedURI}`);
      });
    });
    context.on('page', page => page.on('console', message => {
      if (message.type() === 'error' && /content.security.policy|violates.*directive/i.test(message.text())) {
        violations.push(message.text());
      }
    }));
    await context.route('**/*', async route => {
      if (!/^https?:\/\/(127\.0\.0\.1|localhost):/.test(route.request().url())) return route.continue();
      try {
        const response = await route.fetch();
        if (!response.headers()['content-type']?.includes('text/html')) return await route.fulfill({ response });
        const body = await response.body();
        await route.fulfill({ status: response.status(), body, headers: {
          ...response.headers(),
          'content-security-policy': new URL(route.request().url()).pathname.startsWith('/admin/') ? adminPolicy : policy,
        } });
      } catch (error) {
        // Prefetches and navigations can be cancelled mid-flight; the request is already gone.
        if (!/disposed|closed|Route is already handled|Target page, context or browser/i.test(String(error))) throw error;
      }
    });
    await use();
    expect(violations, 'Unexpected CSP violations under response + meta policies').toEqual([]);
  }, { auto: true }],
});
