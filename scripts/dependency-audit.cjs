#!/usr/bin/env node
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, 'reports', 'engineering');
const OUTPUT_JSON = path.join(OUTPUT_DIR, 'dependency-audit.json');

function run(command, args) {
  const result = spawnSync(command, args, { cwd: ROOT, encoding: 'utf8', shell: process.platform === 'win32' });
  return {
    status: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || ''
  };
}

function parseJsonSafe(raw) {
  if (!raw || !raw.trim()) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function main() {
  const outdatedCmd = run('npm', ['outdated', '--json']);
  const depcheckCmd = run('npx', ['depcheck', '--json']);

  const report = {
    generatedAt: new Date().toISOString(),
    outdated: {
      status: outdatedCmd.status,
      parsed: parseJsonSafe(outdatedCmd.stdout),
      stderr: outdatedCmd.stderr.trim()
    },
    depcheck: {
      status: depcheckCmd.status,
      parsed: parseJsonSafe(depcheckCmd.stdout),
      stderr: depcheckCmd.stderr.trim()
    }
  };

  ensureDir(OUTPUT_DIR);
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(report, null, 2) + '\n', 'utf8');

  const outdatedCount = report.outdated.parsed ? Object.keys(report.outdated.parsed).length : 0;
  const unusedCount = report.depcheck.parsed?.dependencies?.length || 0;
  console.log(`Dependency audit written: ${path.relative(ROOT, OUTPUT_JSON)}`);
  console.log(`Outdated packages: ${outdatedCount}`);
  console.log(`Depcheck unused dependencies: ${unusedCount}`);
}

main();
