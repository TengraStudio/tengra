#!/usr/bin/env node
 
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const TARGET_DIRS = ['src/main', 'src/native'];
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'out', 'coverage', 'test-results']);
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.rs', '.sql']);

function walk(dir, output = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) {
      continue;
    }
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, output);
      continue;
    }
    const ext = path.extname(entry.name).toLowerCase();
    if (SOURCE_EXTENSIONS.has(ext)) {
      output.push(fullPath);
    }
  }
  return output;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function loadFiles() {
  const files = [];
  for (const rel of TARGET_DIRS) {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) {
      continue;
    }
    walk(abs, files);
  }
  return files;
}

function main() {
  const files = loadFiles();
  const rows = files.map(file => ({
    file,
    text: fs.readFileSync(file, 'utf8')
  }));

  const createRegex = /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+([a-zA-Z0-9_]+)/gi;
  const tableSet = new Set();
  for (const row of rows) {
    let match;
    while ((match = createRegex.exec(row.text)) !== null) {
      tableSet.add(match[1]);
    }
  }

  const tables = Array.from(tableSet).sort((a, b) => a.localeCompare(b));
  const result = tables.map(table => {
    const createPattern = new RegExp(`CREATE\\s+TABLE\\s+IF\\s+NOT\\s+EXISTS\\s+${escapeRegExp(table)}\\b`, 'gi');
    const opPattern = new RegExp(`\\b(FROM|INTO|UPDATE|DELETE\\s+FROM)\\s+${escapeRegExp(table)}\\b`, 'gi');

    let createRefs = 0;
    let opRefs = 0;
    const opFiles = [];

    for (const row of rows) {
      const createHits = row.text.match(createPattern);
      const opHits = row.text.match(opPattern);
      if (createHits) {
        createRefs += createHits.length;
      }
      if (opHits) {
        opRefs += opHits.length;
        opFiles.push(path.relative(ROOT, row.file));
      }
    }

    return {
      table,
      createRefs,
      opRefs,
      usedInFiles: Array.from(new Set(opFiles)).sort()
    };
  });

  const unusedCandidates = result.filter(item => item.opRefs === 0);
  console.log(JSON.stringify({ generatedAt: new Date().toISOString(), tables: result, unusedCandidates }, null, 2));
}

main();
