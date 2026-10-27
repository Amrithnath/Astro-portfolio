#!/usr/bin/env node
// Fails when CodeQL SARIF output contains error-level or medium+ security findings,
// so later CI stages are skipped instead of spending runner minutes.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2] ?? 'sarif-results';
const findings = [];

for (const file of readdirSync(dir).filter(name => name.endsWith('.sarif'))) {
  const sarif = JSON.parse(readFileSync(join(dir, file), 'utf8'));
  for (const run of sarif.runs ?? []) {
    const rules = new Map();
    for (const rule of run.tool?.driver?.rules ?? []) rules.set(rule.id, rule);
    for (const extension of run.tool?.extensions ?? []) {
      for (const rule of extension.rules ?? []) rules.set(rule.id, rule);
    }
    for (const result of run.results ?? []) {
      if (result.suppressions?.length) continue;
      const rule = rules.get(result.ruleId) ?? {};
      const severity = Number(rule.properties?.['security-severity'] ?? 0);
      const level = result.level ?? rule.defaultConfiguration?.level ?? 'warning';
      if (level !== 'error' && severity < 4) continue;
      const location = result.locations?.[0]?.physicalLocation;
      findings.push(
        `${result.ruleId} (${severity || level}) ${location?.artifactLocation?.uri ?? '?'}:` +
          `${location?.region?.startLine ?? '?'} ${result.message?.text ?? ''}`
      );
    }
  }
}

if (findings.length) {
  console.error(`CodeQL gate failed with ${findings.length} finding(s):`);
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}
console.log('CodeQL gate passed: no error-level or medium+ security findings.');
