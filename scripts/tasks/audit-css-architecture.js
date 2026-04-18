const fs = require('fs');
const path = require('path');

const projectRoot = process.cwd();
const rendererRoot = path.join(projectRoot, 'src', 'renderer');
const stylesRoot = path.join(rendererRoot, 'styles');
const mainEntryPath = path.join(rendererRoot, 'main.tsx');
const styleEntryPath = path.join(stylesRoot, 'index.css');
const legacyIndexPath = path.join(rendererRoot, 'index.css');

const issues = [];

function walk(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(abs, files);
      continue;
    }
    if (entry.isFile()) {
      files.push(abs);
    }
  }
  return files;
}

function toPosix(relPath) {
  return relPath.replace(/\\/g, '/');
}

if (!fs.existsSync(stylesRoot)) {
  issues.push('Missing renderer styles directory: src/renderer/styles');
}

if (!fs.existsSync(mainEntryPath)) {
  issues.push('Missing renderer main entry: src/renderer/main.tsx');
}

if (!fs.existsSync(styleEntryPath)) {
  issues.push('Missing renderer style entry: src/renderer/styles/index.css');
}

if (fs.existsSync(legacyIndexPath)) {
  issues.push('Legacy renderer stylesheet still exists: src/renderer/index.css');
}

if (fs.existsSync(rendererRoot)) {
  const cssFiles = walk(rendererRoot).filter((file) => file.endsWith('.css'));
  for (const file of cssFiles) {
    if (!file.startsWith(stylesRoot)) {
      issues.push(`Renderer CSS must live under src/renderer/styles: ${toPosix(path.relative(projectRoot, file))}`);
    }
  }
}

if (fs.existsSync(mainEntryPath)) {
  const content = fs.readFileSync(mainEntryPath, 'utf8');
  if (!content.includes("import '@renderer/styles/index.css';")) {
    issues.push("src/renderer/main.tsx must import '@renderer/styles/index.css'");
  }
}

if (fs.existsSync(styleEntryPath)) {
  const content = fs.readFileSync(styleEntryPath, 'utf8');
  const lineCount = content.split(/\r?\n/).length;
  if (lineCount > 120) {
    issues.push(`src/renderer/styles/index.css should stay as a small entry file (current: ${lineCount} lines)`);
  }

  const importCount = (content.match(/@import\s+url\(/g) || []).length;
  if (importCount === 0) {
    issues.push('src/renderer/styles/index.css should import modular CSS layers via @import url(...)');
  }
}

if (issues.length === 0) {
  console.log('Renderer CSS architecture audit passed.');
  process.exit(0);
}

console.error(`Renderer CSS architecture audit failed with ${issues.length} issue(s):`);
for (const issue of issues) {
  console.error(`- ${issue}`);
}
process.exit(1);
