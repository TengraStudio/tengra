/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * Performance budget checker for Tengra build output.
 *
 * Compares raw file sizes in dist/ against defined budgets and
 * reports violations. Exits with code 1 if any budget is exceeded.
 *
 * Usage: node scripts/check-bundle-size.cjs
 */

'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const DIST_DIR = path.resolve(__dirname, '../../dist');

const MB = 1024 * 1024;
const KB = 1024;

const BUDGETS = [
  {
    label: 'Main bundle',
    pattern: 'dist/main/main-*.js',
    maxBytes: 10 * MB,
  },
  {
    label: 'Preload script',
    pattern: 'dist/preload/preload.js',
    maxBytes: 150 * KB,
  },
  {
    label: 'Renderer shell entry path',
    patterns: [
      'dist/renderer/index.html',
      'dist/renderer/assets/index-*.js',
      'dist/renderer/assets/index-*.css',
      'dist/renderer/assets/react-vendor-*.js',
      'dist/renderer/assets/WorkspacePage-*.js',
    ],
    maxBytes: 2 * MB,
    aggregate: true,
  },
  {
    label: 'Workspace details chunk',
    pattern: 'dist/renderer/assets/WorkspaceDetails-*.js',
    maxBytes: 550 * KB,
  },
  {
    label: 'Monaco runtime chunk',
    pattern: 'dist/renderer/assets/monaco-*.js',
    maxBytes: 4.5 * MB,
  },
  {
    label: 'Monaco worker shell',
    patterns: [
      'dist/renderer/assets/css.worker-*.js',
      'dist/renderer/assets/html.worker-*.js',
      'dist/renderer/assets/json.worker-*.js',
    ],
    maxBytes: 2.25 * MB,
    aggregate: true,
  },
  {
    label: 'Monaco TypeScript worker',
    pattern: 'dist/renderer/assets/ts.worker-*.js',
    maxBytes: 7.5 * MB,
  },
  {
    label: 'Terminal runtime chunk',
    pattern: 'dist/renderer/assets/xterm-*.js',
    maxBytes: 450 * KB,
  },
  {
    label: 'Diagram runtime chunk',
    pattern: 'dist/renderer/assets/mermaid-*.js',
    maxBytes: 3.25 * MB,
  },
  {
    label: 'Math runtime chunk',
    pattern: 'dist/renderer/assets/katex-*.js',
    maxBytes: 325 * KB,
  },
  {
    label: 'Flow runtime chunk',
    pattern: 'dist/renderer/assets/react-flow-*.js',
    maxBytes: 200 * KB,
  },
];

function gzipSize(filePath) {
  const content = fs.readFileSync(filePath);
  return zlib.gzipSync(content, { level: 9 }).length;
}

/** Recursively collect all files under a directory. */
function walkDir(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkDir(full));
    } else {
      results.push(full);
    }
  }
  return results;
}

/**
 * Match files against a simplified glob pattern.
 * Supports `*` (single segment) and `**` (recursive).
 */
function matchFiles(pattern) {
  const parts = pattern.split('/');
  const baseParts = [];
  let globStart = -1;

  for (let i = 0; i < parts.length; i++) {
    if (parts[i].includes('*')) {
      globStart = i;
      break;
    }
    baseParts.push(parts[i]);
  }

  if (globStart === -1) {
    const full = path.resolve(DIST_DIR, '..', pattern);
    return fs.existsSync(full) ? [full] : [];
  }

  const baseDir = path.resolve(DIST_DIR, '..', baseParts.join('/'));
  if (!fs.existsSync(baseDir)) return [];

  const isRecursive = parts.some((p) => p === '**');
  const filePattern = parts[parts.length - 1];

  if (isRecursive) {
    return walkDir(baseDir);
  }

  // Single-level glob with wildcard in filename
  const dir = baseDir;
  if (!fs.existsSync(dir)) return [];

  const regex = new RegExp(
    '^' + filePattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$'
  );

  return fs
    .readdirSync(dir)
    .filter((f) => regex.test(f))
    .map((f) => path.join(dir, f))
    .filter((f) => fs.statSync(f).isFile());
}

function getBudgetPatterns(budget) {
  if (budget.patterns && budget.patterns.length > 0) {
    return budget.patterns;
  }

  if (budget.pattern) {
    return [budget.pattern];
  }

  return [];
}

function collectBudgetFiles(budget) {
  const uniqueFiles = new Set();

  for (const pattern of getBudgetPatterns(budget)) {
    for (const file of matchFiles(pattern)) {
      uniqueFiles.add(file);
    }
  }

  return [...uniqueFiles];
}

function formatSize(bytes) {
  if (bytes >= MB) return `${(bytes / MB).toFixed(2)} MB`;
  if (bytes >= KB) return `${(bytes / KB).toFixed(1)} KB`;
  return `${bytes} B`;
}

function main() {
  if (!fs.existsSync(DIST_DIR)) {
    process.stderr.write('ERROR: dist/ directory not found. Run the build first.\n');
    process.exit(1);
  }

  const results = [];

  for (const budget of BUDGETS) {
    const files = collectBudgetFiles(budget);

    if (files.length === 0) {
      process.stderr.write(`WARN: No files matched pattern(s) "${getBudgetPatterns(budget).join(', ')}"\n`);
      continue;
    }

    if (budget.aggregate) {
      const totalSize = files.reduce((sum, f) => sum + fs.statSync(f).size, 0);
      results.push({
        label: budget.label,
        file: budget.label,
        size: totalSize,
        maxBytes: budget.maxBytes,
        passed: totalSize <= budget.maxBytes,
      });
    } else {
      for (const filePath of files) {
        const stat = fs.statSync(filePath);
        const relPath = path.relative(path.resolve(DIST_DIR, '..'), filePath);
        results.push({
          label: budget.label,
          file: relPath,
          size: stat.size,
          maxBytes: budget.maxBytes,
          passed: stat.size <= budget.maxBytes,
        });
      }
    }
  }

  // Print report
  const colFile = 50;
  const colSize = 12;
  const colBudget = 12;
  const colStatus = 8;

  process.stdout.write('\n=== Performance Budget Report ===\n\n');
  process.stdout.write(
    `${'File / Rule'.padEnd(colFile)} ${'Size'.padStart(colSize)} ${'Budget'.padStart(colBudget)} ${'Status'.padStart(colStatus)}\n`
  );
  process.stdout.write(`${'-'.repeat(colFile + colSize + colBudget + colStatus + 3)}\n`);

  let hasFailure = false;

  for (const r of results) {
    const icon = r.passed ? '✅' : '❌';
    const status = r.passed ? 'OK' : 'OVER';
    const displayFile =
      r.file.length > colFile - 2 ? '…' + r.file.slice(-(colFile - 3)) : r.file;

    process.stdout.write(
      `${displayFile.padEnd(colFile)} ${formatSize(r.size).padStart(colSize)} ${formatSize(r.maxBytes).padStart(colBudget)} ${icon} ${status}\n`
    );

    if (!r.passed) hasFailure = true;
  }

  process.stdout.write('\n');

  if (hasFailure) {
    process.stderr.write('❌ BUDGET EXCEEDED: One or more bundles are over their size budget.\n');
    process.exit(1);
  }

  process.stdout.write('✅ All bundles are within their performance budgets.\n');
}

main();
