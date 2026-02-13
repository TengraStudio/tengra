#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const COVERAGE_SUMMARY = path.join(ROOT, 'coverage', 'coverage-summary.json');
const OUTPUT_DIR = path.join(ROOT, 'reports', 'engineering');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'coverage-summary.report.json');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function main() {
  if (!fs.existsSync(COVERAGE_SUMMARY)) {
    console.log('Coverage summary not found. Run `npm run test:coverage` first.');
    process.exit(0);
  }

  const raw = fs.readFileSync(COVERAGE_SUMMARY, 'utf8');
  const parsed = JSON.parse(raw);
  const total = parsed.total || {};

  const report = {
    generatedAt: new Date().toISOString(),
    source: path.relative(ROOT, COVERAGE_SUMMARY),
    totals: {
      lines: total.lines || null,
      statements: total.statements || null,
      functions: total.functions || null,
      branches: total.branches || null
    }
  };

  ensureDir(OUTPUT_DIR);
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log(`Coverage report written: ${path.relative(ROOT, OUTPUT_FILE)}`);
}

main();

