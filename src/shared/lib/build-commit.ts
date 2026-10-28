import { execFileSync } from 'node:child_process';

/** Commit the site was built from: CI's GITHUB_SHA, else the local checkout, else `dev`. */
export function getBuildCommit(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return 'dev';
  }
}
