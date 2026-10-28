import pkg from '../../package.json';
import { getBuildCommit } from '../shared/lib/build-commit';

export const prerender = true;

export function GET() {
  return new Response(
    JSON.stringify({
      version: pkg.version,
      commit: getBuildCommit(),
      builtAt: new Date().toISOString(),
    }),
    { headers: { 'Content-Type': 'application/json; charset=utf-8' } },
  );
}
