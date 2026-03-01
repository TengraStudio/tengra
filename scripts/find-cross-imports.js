#!/usr/bin/env node

/**
 * Cross-import violation checker for Tengra.
 *
 * Detects forbidden import patterns:
 *   - src/renderer/ files importing from @main/ or src/main/
 *   - src/main/ files importing from @/ (renderer alias) or src/renderer/
 */

const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '..', 'src');
const IMPORT_RE = /(?:import|require)\s*\(?['"]([^'"]+)['"]\)?/g;

/** @type {{ file: string; line: number; text: string; kind: string }[]} */
const violations = [];

/**
 * Recursively collect .ts/.tsx files under a directory.
 * @param {string} dir
 * @returns {string[]}
 */
function collectTsFiles(dir) {
  /** @type {string[]} */
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules') {
      results.push(...collectTsFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

/**
 * Check a single file for cross-import violations.
 * @param {string} filePath
 * @param {'renderer'|'main'} layer
 */
function checkFile(filePath, layer) {
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  const maxLines = Math.min(lines.length, 2000);
  for (let i = 0; i < maxLines; i++) {
    const line = lines[i];
    let match;
    IMPORT_RE.lastIndex = 0;
    while ((match = IMPORT_RE.exec(line)) !== null) {
      const specifier = match[1];
      if (layer === 'renderer') {
        if (specifier.startsWith('@main/') || specifier.includes('src/main/')) {
          violations.push({ file: path.relative(SRC, filePath), line: i + 1, text: line.trim(), kind: 'renderer→main' });
        }
      } else {
        if (specifier.startsWith('@/') || specifier.includes('src/renderer/') || specifier.startsWith('@renderer/')) {
          violations.push({ file: path.relative(SRC, filePath), line: i + 1, text: line.trim(), kind: 'main→renderer' });
        }
      }
    }
  }
}

// Scan renderer files
const rendererDir = path.join(SRC, 'renderer');
if (fs.existsSync(rendererDir)) {
  for (const f of collectTsFiles(rendererDir)) { checkFile(f, 'renderer'); }
}

// Scan main files
const mainDir = path.join(SRC, 'main');
if (fs.existsSync(mainDir)) {
  for (const f of collectTsFiles(mainDir)) { checkFile(f, 'main'); }
}

if (violations.length === 0) {
  process.stdout.write('✅ No cross-import violations found.\n');
  process.exit(0);
} else {
  process.stdout.write(`❌ Found ${violations.length} cross-import violation(s):\n\n`);
  for (const v of violations) {
    process.stdout.write(`  [${v.kind}] ${v.file}:${v.line}\n    ${v.text}\n\n`);
  }
  process.exit(1);
}
