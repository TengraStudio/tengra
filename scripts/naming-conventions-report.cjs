#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const TARGET_DIRS = ['src', 'scripts'];
const OUTPUT_DIR = path.join(ROOT, 'reports', 'engineering');
const OUTPUT_JSON = path.join(OUTPUT_DIR, 'naming-conventions-report.json');
const OUTPUT_MD = path.join(OUTPUT_DIR, 'naming-conventions-report.md');

const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PASCAL_CASE = /^[A-Z][A-Za-z0-9]*$/;
const CAMEL_CASE = /^[a-z][A-Za-z0-9]*$/;
const ALLOWED_DOT_SUFFIXES = new Set([
  'service',
  'repository',
  'interface',
  'server',
  'handler',
  'util',
  'utils',
  'types',
  'type',
  'config',
  'provider',
  'factory',
  'adapter',
  'client',
  'manager',
  'controller',
  'middleware',
  'model',
  'entity',
  'store',
  'hook'
]);

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'coverage') {
        continue;
      }
      walk(full, files);
      continue;
    }
    files.push(full);
  }
  return files;
}

function classifyFileName(baseName, ext) {
  const raw = baseName.replace(/\.(test|spec)$/i, '');
  const parts = raw.split('.');
  const hasAllowedSuffix = parts.length > 1 && ALLOWED_DOT_SUFFIXES.has(parts[parts.length - 1]);
  const normalized = hasAllowedSuffix ? parts.slice(0, -1).join('.') : raw;
  const token = normalized.replace(/\./g, '-');
  if (ext === '.tsx') {
    if (PASCAL_CASE.test(normalized) || KEBAB_CASE.test(token) || CAMEL_CASE.test(normalized)) return null;
    return 'tsx files should be PascalCase or kebab-case';
  }
  if (ext === '.ts' || ext === '.js' || ext === '.cjs' || ext === '.mjs') {
    if (KEBAB_CASE.test(token) || CAMEL_CASE.test(normalized) || PASCAL_CASE.test(normalized)) return null;
    return 'script/module files should be kebab-case or camelCase';
  }
  return null;
}

function checkDirectories(filePath) {
  const rel = path.relative(ROOT, filePath);
  const parts = rel.split(path.sep).slice(0, -1);
  const violations = [];
  for (const part of parts) {
    if (part.startsWith('.') || part.startsWith('__') || part === 'src' || part === 'scripts') {
      continue;
    }
    if (!KEBAB_CASE.test(part) && !CAMEL_CASE.test(part)) {
      violations.push(`directory "${part}" should be kebab-case or camelCase`);
    }
  }
  return violations;
}

function analyze() {
  const violations = [];
  let checkedFiles = 0;

  for (const target of TARGET_DIRS) {
    const abs = path.join(ROOT, target);
    if (!fs.existsSync(abs)) continue;
    for (const file of walk(abs)) {
      const ext = path.extname(file);
      if (!['.ts', '.tsx', '.js', '.cjs', '.mjs'].includes(ext)) continue;
      checkedFiles += 1;

      const base = path.basename(file, ext);
      const fileViolation = classifyFileName(base, ext);
      const dirViolations = checkDirectories(file);

      if (fileViolation) {
        violations.push({ path: path.relative(ROOT, file), type: 'file', message: fileViolation });
      }
      for (const msg of dirViolations) {
        violations.push({ path: path.relative(ROOT, file), type: 'directory', message: msg });
      }
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    checkedFiles,
    violationCount: violations.length,
    violations
  };
}

function toMarkdown(report) {
  const lines = [];
  lines.push('# Naming Conventions Report');
  lines.push('');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Checked files: ${report.checkedFiles}`);
  lines.push(`Violations: ${report.violationCount}`);
  lines.push('');
  lines.push('## Top Violations');
  lines.push('');

  for (const row of report.violations.slice(0, 80)) {
    lines.push(`- ${row.path}: ${row.message}`);
  }

  if (report.violations.length > 80) {
    lines.push('');
    lines.push(`...and ${report.violations.length - 80} more`);
  }

  return lines.join('\n');
}

function main() {
  const report = analyze();
  ensureDir(OUTPUT_DIR);
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(report, null, 2) + '\n', 'utf8');
  fs.writeFileSync(OUTPUT_MD, toMarkdown(report) + '\n', 'utf8');

  console.log(`Naming conventions report written: ${path.relative(ROOT, OUTPUT_JSON)}`);
  console.log(`Violations: ${report.violationCount}`);
}

main();
