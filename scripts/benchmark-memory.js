/**
 * Memory usage benchmark (lightweight)
 */
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'reports', 'performance', 'memory-usage.json');
const SAMPLES = Number(process.env.MEM_SAMPLES || 20);
const INTERVAL_MS = Number(process.env.MEM_INTERVAL_MS || 200);

async function main() {
  const samples = [];
  for (let i = 0; i < SAMPLES; i++) {
    const usage = process.memoryUsage();
    samples.push({
      ts: Date.now(),
      rss: usage.rss,
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      external: usage.external
    });
    await new Promise(resolve => setTimeout(resolve, INTERVAL_MS));
  }

  const avg = (key) => Math.round(samples.reduce((sum, s) => sum + s[key], 0) / samples.length);
  const payload = {
    generatedAt: new Date().toISOString(),
    sampleCount: samples.length,
    intervalMs: INTERVAL_MS,
    avg: {
      rss: avg('rss'),
      heapUsed: avg('heapUsed'),
      heapTotal: avg('heapTotal'),
      external: avg('external')
    },
    max: {
      rss: Math.max(...samples.map(s => s.rss)),
      heapUsed: Math.max(...samples.map(s => s.heapUsed))
    },
    samples
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`Memory benchmark saved: ${OUT}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

