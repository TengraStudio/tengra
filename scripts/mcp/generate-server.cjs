#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const templatePath = path.join(ROOT, 'src', 'main', 'mcp', 'templates', 'server.template.ts');

function toPascalCase(input) {
  return String(input)
    .replace(/(^\w|-\w)/g, s => s.replace('-', '').toUpperCase())
    .replace(/[^a-zA-Z0-9]/g, '');
}

function main() {
  const nameArg = process.argv.find(a => a.startsWith('--name='));
  const name = nameArg ? nameArg.split('=')[1] : '';
  if (!name) {
    console.error('Usage: node scripts/mcp/generate-server.cjs --name=my-server');
    process.exit(1);
  }

  const fileName = `${name}.server.ts`;
  const targetPath = path.join(ROOT, 'src', 'main', 'mcp', 'servers', fileName);
  if (fs.existsSync(targetPath)) {
    console.error(`Server already exists: ${targetPath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(templatePath, 'utf8');
  const fnName = `build${toPascalCase(name)}Server`;
  const output = raw
    .replace(/buildTemplateServer/g, fnName)
    .replace(/template-server/g, name);

  fs.writeFileSync(targetPath, output, 'utf8');
  console.log(`Created MCP server template: ${path.relative(ROOT, targetPath)}`);
}

main();

