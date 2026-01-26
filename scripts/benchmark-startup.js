/**
 * Startup Performance Benchmark
 * Measures application startup time and reports metrics
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const BENCHMARK_RUNS = 3;
const TIMEOUT_MS = 30000;
const THRESHOLD_MS = 5000; // Fail if startup takes longer than 5 seconds

/**
 * Run a single benchmark iteration
 */
async function runBenchmark() {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();

        // Start the Electron app in headless mode
        const electronProcess = spawn('npm', ['run', 'electron:dev', '--', '--no-sandbox', '--headless'], {
            stdio: 'pipe',
            shell: true
        });

        let resolved = false;
        const timeout = setTimeout(() => {
            if (!resolved) {
                resolved = true;
                electronProcess.kill();
                reject(new Error(`Benchmark timed out after ${TIMEOUT_MS}ms`));
            }
        }, TIMEOUT_MS);

        // Listen for app ready signal
        electronProcess.stdout.on('data', (data) => {
            const output = data.toString();

            // Look for ready signal (adjust based on your app's output)
            if (output.includes('Window created') || output.includes('ready-to-show')) {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timeout);
                    const duration = Date.now() - startTime;
                    electronProcess.kill();
                    resolve(duration);
                }
            }
        });

        electronProcess.stderr.on('data', (data) => {
            // Log errors but don't fail immediately
            console.error('Benchmark stderr:', data.toString());
        });

        electronProcess.on('error', (error) => {
            if (!resolved) {
                resolved = true;
                clearTimeout(timeout);
                reject(error);
            }
        });

        electronProcess.on('exit', (code) => {
            if (!resolved) {
                resolved = true;
                clearTimeout(timeout);
                if (code !== 0) {
                    reject(new Error(`Process exited with code ${code}`));
                } else {
                    // If process exited cleanly but we didn't get ready signal
                    resolve(Date.now() - startTime);
                }
            }
        });
    });
}

/**
 * Calculate statistics from benchmark results
 */
function calculateStats(times) {
    const sorted = [...times].sort((a, b) => a - b);
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const median = sorted[Math.floor(sorted.length / 2)];
    const min = sorted[0];
    const max = sorted[sorted.length - 1];

    return { avg, median, min, max };
}

/**
 * Main benchmark function
 */
async function main() {
    console.log('🚀 Starting Electron Startup Benchmark...');
    console.log(`Running ${BENCHMARK_RUNS} iterations...\n`);

    const times = [];

    for (let i = 0; i < BENCHMARK_RUNS; i++) {
        try {
            console.log(`Run ${i + 1}/${BENCHMARK_RUNS}...`);
            const duration = await runBenchmark();
            times.push(duration);
            console.log(`✓ Completed in ${duration}ms\n`);

            // Wait a bit between runs
            await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
            console.error(`✗ Run ${i + 1} failed:`, error.message);
            // Continue with other runs
        }
    }

    if (times.length === 0) {
        console.error('❌ All benchmark runs failed');
        process.exit(1);
    }

    // Calculate and display statistics
    const stats = calculateStats(times);

    console.log('📊 Benchmark Results:');
    console.log('─'.repeat(40));
    console.log(`Average:  ${stats.avg.toFixed(2)}ms`);
    console.log(`Median:   ${stats.median.toFixed(2)}ms`);
    console.log(`Min:      ${stats.min.toFixed(2)}ms`);
    console.log(`Max:      ${stats.max.toFixed(2)}ms`);
    console.log('─'.repeat(40));

    // Save results to file
    const resultsPath = path.join(__dirname, '..', 'benchmark-results.json');
    const results = {
        timestamp: new Date().toISOString(),
        runs: times,
        stats,
        threshold: THRESHOLD_MS
    };

    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    console.log(`\n💾 Results saved to ${resultsPath}`);

    // Check against threshold
    if (stats.avg > THRESHOLD_MS) {
        console.error(`\n❌ FAILED: Average startup time (${stats.avg.toFixed(2)}ms) exceeds threshold (${THRESHOLD_MS}ms)`);
        process.exit(1);
    } else {
        console.log(`\n✅ PASSED: Startup time within acceptable range`);
        process.exit(0);
    }
}

// Run benchmark
main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
