#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const SERVERS_DIR = path.join(ROOT, 'src', 'main', 'mcp', 'servers');
const OUTPUT = path.join(ROOT, 'docs', 'MCP_SERVERS.generated.md');

function main() {
  const files = fs.readdirSync(SERVERS_DIR).filter(f => f.endsWith('.server.ts')).sort();
  const lines = [];
  lines.push('# MCP Servers (Generated)');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('## Modules');
  lines.push('');
  for (const file of files) {
    const full = path.join(SERVERS_DIR, file);
    const content = fs.readFileSync(full, 'utf8');
    const fnMatches = [...content.matchAll(/export function (build[A-Za-z0-9]+)\(/g)].map(m => m[1]);
    lines.push(`- \`${file}\`${fnMatches.length ? `: ${fnMatches.join(', ')}` : ''}`);
  }
  lines.push('');
  fs.writeFileSync(OUTPUT, lines.join('\n') + '\n', 'utf8');
  console.log(`MCP docs generated: ${path.relative(ROOT, OUTPUT)}`);
}

main();

