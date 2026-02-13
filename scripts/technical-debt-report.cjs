#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const TODO_FILE = path.join(ROOT, 'docs', 'TODO.md');
const OUTPUT_DIR = path.join(ROOT, 'reports', 'engineering');
const OUTPUT_JSON = path.join(OUTPUT_DIR, 'technical-debt-report.json');
const OUTPUT_MD = path.join(OUTPUT_DIR, 'technical-debt-report.md');

function parseTodos(content) {
  const lines = content.split(/\r?\n/);
  const sectionTotals = new Map();
  const sectionOpen = new Map();
  let currentSection = 'General';

  for (const line of lines) {
    const sectionMatch = /^###\s+(.+)$/.exec(line.trim());
    if (sectionMatch) {
      currentSection = sectionMatch[1];
      if (!sectionTotals.has(currentSection)) {
        sectionTotals.set(currentSection, 0);
        sectionOpen.set(currentSection, 0);
      }
      continue;
    }

    const todoMatch = /^- \[( |x)\]\s+\*\*(.+?)\*\*:/.exec(line.trim());
    if (!todoMatch) continue;

    sectionTotals.set(currentSection, (sectionTotals.get(currentSection) || 0) + 1);
    if (todoMatch[1] === ' ') {
      sectionOpen.set(currentSection, (sectionOpen.get(currentSection) || 0) + 1);
    }
  }

  const sections = [...sectionTotals.entries()].map(([name, total]) => {
    const open = sectionOpen.get(name) || 0;
    const completed = total - open;
    const completionRate = total === 0 ? 1 : completed / total;
    return { name, total, open, completed, completionRate };
  }).sort((a, b) => b.open - a.open);

  const total = sections.reduce((acc, s) => acc + s.total, 0);
  const open = sections.reduce((acc, s) => acc + s.open, 0);

  return {
    generatedAt: new Date().toISOString(),
    file: path.relative(ROOT, TODO_FILE),
    total,
    open,
    completed: total - open,
    completionRate: total === 0 ? 1 : (total - open) / total,
    sections
  };
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeMarkdown(report) {
  const lines = [];
  lines.push('# Technical Debt Report');
  lines.push('');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Source: ${report.file}`);
  lines.push('');
  lines.push(`- Total TODOs: ${report.total}`);
  lines.push(`- Open TODOs: ${report.open}`);
  lines.push(`- Completed TODOs: ${report.completed}`);
  lines.push(`- Completion: ${(report.completionRate * 100).toFixed(1)}%`);
  lines.push('');
  lines.push('## Sections');
  lines.push('');
  for (const section of report.sections) {
    lines.push(`- ${section.name}: open=${section.open}, completed=${section.completed}, total=${section.total}`);
  }
  lines.push('');
  return lines.join('\n');
}

function main() {
  const content = fs.readFileSync(TODO_FILE, 'utf8');
  const report = parseTodos(content);

  ensureDir(OUTPUT_DIR);
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(report, null, 2) + '\n', 'utf8');
  fs.writeFileSync(OUTPUT_MD, writeMarkdown(report), 'utf8');

  console.log(`Technical debt report written: ${path.relative(ROOT, OUTPUT_JSON)}`);
  console.log(`Technical debt markdown: ${path.relative(ROOT, OUTPUT_MD)}`);
}

main();
