const fs = require('fs');
const path = require('path');

const ITERATIONS = Number(process.env.DB_BENCH_ITERATIONS || 3000);
const RESULTS_PATH = path.join(__dirname, '..', 'reports', 'performance', 'db-performance.json');

function benchmarkInMemoryMap() {
  const rows = [];
  const byId = new Map();
  const startedAt = performance.now();

  for (let i = 0; i < ITERATIONS; i++) {
    const row = { id: `id-${i}`, value: `value-${i}`, ts: Date.now() };
    rows.push(row);
    byId.set(row.id, row);
  }

  for (let i = 0; i < ITERATIONS; i++) {
    byId.get(`id-${i}`);
  }

  for (let i = 0; i < ITERATIONS; i += 2) {
    byId.delete(`id-${i}`);
  }

  const elapsed = performance.now() - startedAt;
  return {
    insertReadDeleteOps: ITERATIONS * 2.5,
    elapsedMs: Number(elapsed.toFixed(3)),
    opsPerSec: Number(((ITERATIONS * 2.5 / elapsed) * 1000).toFixed(2)),
    remainingRows: byId.size
  };
}

function main() {
  const metrics = benchmarkInMemoryMap();
  const payload = {
    generatedAt: new Date().toISOString(),
    iterations: ITERATIONS,
    metrics
  };
  fs.mkdirSync(path.dirname(RESULTS_PATH), { recursive: true });
  fs.writeFileSync(RESULTS_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`DB benchmark saved: ${RESULTS_PATH}`);
}

main();

