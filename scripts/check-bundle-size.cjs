/**
 * Bundle-size budget checker for Tengra renderer output.
 *
 * Scans dist/renderer/assets for JS chunks, computes gzipped sizes,
 * and enforces per-category budgets.
 *
 * Usage: node scripts/check-bundle-size.cjs
 */

'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

/** @type {Record<string, number>} Budget in bytes (gzipped) */
const BUDGETS = {
  // Shell / layout / app entry chunks
  shell: 150 * 1024, // 150 KB gzipped
  // Vendor bundle (React + common deps)
  vendor: 350 * 1024, // 350 KB gzipped
  // Lazy-loaded heavy chunks get generous limits
  monaco: 2048 * 1024, // 2 MB
  katex: 512 * 1024,
  xterm: 256 * 1024,
  'react-flow': 256 * 1024,
  syntax: 256 * 1024,
};

/**
 * Classify a chunk filename into a budget category.
 * @param {string} filename
 * @returns {string} category key or 'uncategorized'
 */
function classifyChunk(filename) {
  const lower = filename.toLowerCase();

  if (lower.startsWith('monaco')) return 'monaco';
  if (lower.startsWith('katex')) return 'katex';
  if (lower.startsWith('xterm')) return 'xterm';
  if (lower.startsWith('react-flow')) return 'react-flow';
  if (lower.startsWith('syntax')) return 'syntax';
  if (lower.startsWith('vendor')) return 'vendor';

  // Entry point and app-level chunks are considered shell/layout
  if (lower.startsWith('index') || lower.startsWith('app')) return 'shell';

  return 'uncategorized';
}

/**
 * Get gzipped size of a file in bytes.
 * @param {string} filePath
 * @returns {number}
 */
function gzipSize(filePath) {
  const content = fs.readFileSync(filePath);
  return zlib.gzipSync(content, { level: 9 }).length;
}

/**
 * Format bytes to a human-readable string.
 * @param {number} bytes
 * @returns {string}
 */
function formatKB(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function main() {
  const assetsDir = path.resolve(__dirname, '..', 'dist', 'renderer', 'assets');

  if (!fs.existsSync(assetsDir)) {
    process.stderr.write('ERROR: dist/renderer/assets not found. Run "vite build" first.\n');
    process.exit(1);
  }

  const jsFiles = fs.readdirSync(assetsDir).filter(
    /** @param {string} f */ (f) => f.endsWith('.js')
  );

  if (jsFiles.length === 0) {
    process.stderr.write('ERROR: No JS chunks found in dist/renderer/assets.\n');
    process.exit(1);
  }

  /** @type {Array<{file: string, category: string, gzipped: number, budget: number | null, over: boolean}>} */
  const results = [];
  let hasViolation = false;

  for (const file of jsFiles) {
    const fullPath = path.join(assetsDir, file);
    const gzipped = gzipSize(fullPath);
    const category = classifyChunk(file);
    const budget = BUDGETS[category] ?? null;
    const over = budget !== null && gzipped > budget;

    if (over) hasViolation = true;
    results.push({ file, category, gzipped, budget, over });
  }

  // Sort by gzipped size descending
  results.sort((a, b) => b.gzipped - a.gzipped);

  // Print report
  process.stdout.write('\n=== Bundle Size Budget Report ===\n\n');
  process.stdout.write(
    `${'Chunk'.padEnd(45)} ${'Category'.padEnd(16)} ${'Gzipped'.padStart(10)} ${'Budget'.padStart(10)} ${'Status'.padStart(8)}\n`
  );
  process.stdout.write(`${'-'.repeat(91)}\n`);

  for (const r of results) {
    const budgetStr = r.budget !== null ? formatKB(r.budget) : '—';
    const status = r.budget === null ? '  —' : r.over ? '  FAIL' : '  OK';
    const marker = r.over ? '❌' : '✅';
    const line = `${r.file.padEnd(45)} ${r.category.padEnd(16)} ${formatKB(r.gzipped).padStart(10)} ${budgetStr.padStart(10)} ${marker}${status}\n`;
    process.stdout.write(line);
  }

  process.stdout.write('\n');

  if (hasViolation) {
    process.stderr.write('BUDGET EXCEEDED: One or more chunks are over their size budget.\n');
    process.exit(1);
  }

  process.stdout.write('All chunks within budget.\n');
}

main();
