/**
 * Security Audit Script (SEC-H-003)
 * Runs npm audit programmatically, parses JSON output, and reports a summary.
 * Exits with code 1 if critical or high vulnerabilities are found.
 *
 * Usage: node scripts/security-audit.cjs
 */

'use strict';

const { execSync } = require('child_process');

function runAudit() {
  let rawOutput;
  try {
    rawOutput = execSync('npm audit --json', {
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (error) {
    // npm audit exits with non-zero when vulnerabilities are found; output is still in stdout
    rawOutput = error.stdout || '';
    if (!rawOutput) {
      console.error('[security-audit] Failed to run npm audit:', error.message);
      process.exit(2);
    }
  }

  let audit;
  try {
    audit = JSON.parse(rawOutput);
  } catch {
    console.error('[security-audit] Failed to parse npm audit JSON output.');
    process.exit(2);
  }

  const vulnerabilities = audit.metadata?.vulnerabilities ?? {};
  const critical = vulnerabilities.critical ?? 0;
  const high = vulnerabilities.high ?? 0;
  const moderate = vulnerabilities.moderate ?? 0;
  const low = vulnerabilities.low ?? 0;
  const info = vulnerabilities.info ?? 0;
  const total = vulnerabilities.total ?? critical + high + moderate + low + info;

  console.log('');
  console.log('╔══════════════════════════════════════╗');
  console.log('║       Security Audit Summary         ║');
  console.log('╠══════════════════════════════════════╣');
  console.log(`║  Critical:  ${String(critical).padStart(6)}                 ║`);
  console.log(`║  High:      ${String(high).padStart(6)}                 ║`);
  console.log(`║  Moderate:  ${String(moderate).padStart(6)}                 ║`);
  console.log(`║  Low:       ${String(low).padStart(6)}                 ║`);
  console.log(`║  Info:      ${String(info).padStart(6)}                 ║`);
  console.log('╠══════════════════════════════════════╣');
  console.log(`║  Total:     ${String(total).padStart(6)}                 ║`);
  console.log('╚══════════════════════════════════════╝');
  console.log('');

  if (critical > 0 || high > 0) {
    console.error(
      `[security-audit] FAIL: ${critical} critical and ${high} high vulnerabilities found.`
    );
    process.exit(1);
  }

  console.log('[security-audit] PASS: No critical or high vulnerabilities.');
  process.exit(0);
}

runAudit();
