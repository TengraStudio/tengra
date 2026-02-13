#!/usr/bin/env node
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, 'reports', 'engineering');
const OUTPUT_JSON = path.join(OUTPUT_DIR, 'code-metrics.json');

function run(command, args) {
  const result = spawnSync(command, args, { cwd: ROOT, encoding: 'utf8', shell: process.platform === 'win32' });
  return {
    status: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || ''
  };
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function loadCoverage() {
  const summaryPath = path.join(ROOT, 'coverage', 'coverage-summary.json');
  if (!fs.existsSync(summaryPath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  } catch {
    return null;
  }
}

function parseComplexityViolations(eslintJsonRaw) {
  try {
    const rows = JSON.parse(eslintJsonRaw);
    let total = 0;
    for (const row of rows) {
      for (const msg of row.messages || []) {
        if (msg.ruleId === 'complexity') {
          total += 1;
        }
      }
    }
    return total;
  } catch {
    return -1;
  }
}

function main() {
  const lintRes = run('npx', ['eslint', 'src', '--ext', '.ts,.tsx', '--format', 'json']);
  const complexityViolations = parseComplexityViolations(lintRes.stdout);
  const coverage = loadCoverage();

  const report = {
    generatedAt: new Date().toISOString(),
    complexity: {
      eslintStatus: lintRes.status,
      violations: complexityViolations,
      stderr: lintRes.stderr.trim()
    },
    coverage: coverage ? coverage.total : null
  };

  ensureDir(OUTPUT_DIR);
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(report, null, 2) + '\n', 'utf8');

  console.log(`Code metrics report written: ${path.relative(ROOT, OUTPUT_JSON)}`);
  console.log(`Complexity violations: ${complexityViolations}`);
  if (!coverage) {
    console.log('Coverage summary not found. Run npm run test:coverage first.');
  }
}

main();
