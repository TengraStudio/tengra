const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const REPORT_DIR = path.join(ROOT, 'reports', 'performance');
const OUT_FILE = path.join(REPORT_DIR, 'dashboard.md');

function readJsonIfExists(file) {
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function main() {
  const startup = readJsonIfExists(path.join(ROOT, 'benchmark-results.json'));
  const ipc = readJsonIfExists(path.join(REPORT_DIR, 'ipc-latency.json'));
  const db = readJsonIfExists(path.join(REPORT_DIR, 'db-performance.json'));

  const lines = [
    '# Performance Dashboard',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Startup',
    startup
      ? `- avg: ${startup.stats?.avg ?? 'n/a'} ms`
      : '- No startup benchmark data',
    '',
    '## IPC Latency',
    ipc
      ? `- avg: ${ipc.metrics?.avgMs ?? 'n/a'} ms, p95: ${ipc.metrics?.p95Ms ?? 'n/a'} ms, p99: ${ipc.metrics?.p99Ms ?? 'n/a'} ms`
      : '- No IPC benchmark data',
    '',
    '## Database',
    db
      ? `- ops/sec: ${db.metrics?.opsPerSec ?? 'n/a'}, elapsed: ${db.metrics?.elapsedMs ?? 'n/a'} ms`
      : '- No DB benchmark data',
    ''
  ];

  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, `${lines.join('\n')}\n`, 'utf8');
  console.log(`Performance dashboard written: ${path.relative(ROOT, OUT_FILE)}`);
}

main();

