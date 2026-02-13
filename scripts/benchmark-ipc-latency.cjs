const fs = require('fs');
const path = require('path');

const ITERATIONS = Number(process.env.ITERATIONS || 500);
const RESULTS_PATH = path.join(__dirname, '..', 'reports', 'performance', 'ipc-latency.json');

async function benchmark() {
  const startedAt = Date.now();
  const samples = [];

  for (let i = 0; i < ITERATIONS; i++) {
    const start = performance.now();
    // Simulate IPC serialization/de-serialization overhead
    const payload = JSON.stringify({ i, channel: 'mock:ping', args: ['hello', i] });
    JSON.parse(payload);
    const end = performance.now();
    samples.push(end - start);
  }

  samples.sort((a, b) => a - b);
  const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
  const p95 = samples[Math.floor(samples.length * 0.95)] || 0;
  const p99 = samples[Math.floor(samples.length * 0.99)] || 0;

  const result = {
    generatedAt: new Date().toISOString(),
    iterations: ITERATIONS,
    totalMs: Date.now() - startedAt,
    metrics: {
      avgMs: Number(avg.toFixed(4)),
      minMs: Number((samples[0] || 0).toFixed(4)),
      p95Ms: Number(p95.toFixed(4)),
      p99Ms: Number(p99.toFixed(4)),
      maxMs: Number((samples[samples.length - 1] || 0).toFixed(4))
    }
  };

  fs.mkdirSync(path.dirname(RESULTS_PATH), { recursive: true });
  fs.writeFileSync(RESULTS_PATH, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.log(`IPC latency benchmark saved: ${RESULTS_PATH}`);
}

benchmark().catch(err => {
  console.error(err);
  process.exit(1);
});

