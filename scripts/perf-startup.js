/**
 * Startup benchmark script
 * Launches the Electron app, waits for it to report "ready",
 * and measures the total elapsed time.
 * If startup exceeds BUDGET_MS, the script exits with failure.
 */

const { spawn } = require('child_process');
const path = require('path');
const os = require('os');

const BUDGET_MS = 5000;
const TIMEOUT_MS = 15000;

console.log('--- Startup Benchmark ---');
console.log(`Target Budget: ${BUDGET_MS}ms`);

const startTime = Date.now();
const electronPath = path.resolve(__dirname, '..', 'node_modules', '.bin', os.platform() === 'win32' ? 'electron.cmd' : 'electron');
const mainPath = path.resolve(__dirname, '..', 'dist', 'main', 'main.js');

// We run the compiled app
const proc = spawn(electronPath, [mainPath], {
    env: { ...process.env, NODE_ENV: 'test', TENGRA_BENCHMARK: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32'
});

let isReady = false;
let failed = false;

const timeout = setTimeout(() => {
    if (!isReady) {
        console.error(`❌ Benchmark TIMEOUT after ${TIMEOUT_MS}ms`);
        proc.kill();
        process.exit(1);
    }
}, TIMEOUT_MS);

proc.stdout.on('data', (data) => {
    const out = data.toString();
    if (out.includes('BENCHMARK_READY')) {
        if (!isReady) {
            isReady = true;
            clearTimeout(timeout);
            const duration = Date.now() - startTime;
            console.log(`App became ready in: ${duration}ms`);

            if (duration > BUDGET_MS) {
                console.error(`❌ BUDGET EXCEEDED: Startup took longer than ${BUDGET_MS}ms.`);
                failed = true;
            } else {
                console.log(`✅ Startup is within the ${BUDGET_MS}ms budget.`);
            }
            // Delay exit to give Electron time to finish app.exit(0) and avoid EPIPE broken pipe.
            setTimeout(() => {
                process.exit(failed ? 1 : 0);
            }, 1000);
        }
    }
});

proc.stderr.on('data', (data) => {});

proc.on('close', (code) => {
    if (!isReady) {
        console.error(`App exited before becoming ready. Exit code: ${code}`);
        process.exit(1);
    }
});
