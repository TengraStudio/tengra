#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForProcessExit(pid) {
    while (true) {
        try {
            process.kill(pid, 0);
            await sleep(500);
        } catch {
            return;
        }
    }
}

async function copyWithRetry(from, to) {
    for (let i = 0; i < 20; i++) {
        try {
            fs.mkdirSync(path.dirname(to), { recursive: true });
            fs.copyFileSync(from, to);
            if (process.platform !== 'win32') {
                fs.chmodSync(to, 0o755);
            }
            return;
        } catch {
            await sleep(500 * Math.min(i + 1, 6));
        }
    }

    throw new Error(`Failed to copy update from ${from} to ${to}`);
}

async function main() {
    const args = new Map();
    for (let i = 2; i < process.argv.length; i += 2) {
        const key = process.argv[i];
        const value = process.argv[i + 1];
        if (key && key.startsWith('--')) {
            args.set(key, value);
        }
    }

    const processId = Number(args.get('--process-id'));
    const sourcePath = args.get('--source-path');
    const targetPath = args.get('--target-path');
    const launchAfter = args.get('--launch-after');

    if (!processId || !sourcePath || !targetPath) {
        throw new Error('Missing required updater arguments');
    }

    await waitForProcessExit(processId);
    await copyWithRetry(sourcePath, targetPath);

    if (launchAfter && fs.existsSync(launchAfter)) {
        const { spawn } = require('child_process');
        const child = spawn(launchAfter, [], { detached: true, stdio: 'ignore' });
        child.unref();
    }
}

main().catch(err => {
    process.stderr.write(`${err?.message || String(err)}\n`);
    process.exit(1);
});
