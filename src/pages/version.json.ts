import { execFileSync } from 'node:child_process';
import pkg from '../../package.json';

export const prerender = true;

function getCommit(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;

  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return 'dev';
  }
}

export function GET() {
  return new Response(
    JSON.stringify({
      version: pkg.version,
      commit: getCommit(),
      builtAt: new Date().toISOString(),
    }),
    { headers: { 'Content-Type': 'application/json; charset=utf-8' } },
  );
}
