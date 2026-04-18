/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const { spawn } = require('child_process');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const STRICT_BUILD = process.env.CI === 'true' || process.env.TENGRA_BUILD_STRICT === 'true';
const ENFORCE_BUNDLE_BUDGET = process.env.CI === 'true' || process.env.TENGRA_ENFORCE_BUNDLE_BUDGET === 'true';

function writeStdout(message) {
    process.stdout.write(`${message}\n`);
}

function writeStderr(message) {
    process.stderr.write(`${message}\n`);
}

/**
 * Runs a command and returns a promise that resolves when the command completes.
 * @param {string} command The command to run.
 * @param {string[]} args The arguments for the command.
 * @param {string} name A label for the command output.
 * @returns {Promise<void>}
 */
let activeProcesses = [];

function terminateProcessTree(proc) {
    if (!proc || proc.killed) {
        return;
    }
    if (process.platform === 'win32') {
        const killer = spawn('taskkill', ['/PID', String(proc.pid), '/T', '/F'], {
            stdio: 'ignore',
            windowsHide: true
        });
        killer.on('error', () => undefined);
        return;
    }
    try {
        process.kill(proc.pid, 'SIGTERM');
    } catch {
        // Ignore kill errors
    }
}

function runCommand(command, args, name) {
    return new Promise((resolve, reject) => {
        const commandLine = [command, ...args].join(' ');
        writeStdout(`[${name}] Starting: ${commandLine}`);
        const startedAt = Date.now();
        const proc = spawn(commandLine, {
            cwd: PROJECT_ROOT,
            shell: true,
            stdio: ['ignore', 'pipe', 'pipe'],
            env: { ...process.env, FORCE_COLOR: '1' }
        });

        activeProcesses.push({ proc, name });

        proc.stdout?.on('data', chunk => {
            process.stdout.write(chunk);
        });
        proc.stderr?.on('data', chunk => {
            process.stderr.write(chunk);
        });

        proc.on('error', (error) => {
            writeStderr(`[${name}] Failed to start: ${error.message}`);
            reject(error);
        });

        proc.on('close', (code) => {
            activeProcesses = activeProcesses.filter(p => p.proc !== proc);
            if (code === 0) {
                const durationMs = Date.now() - startedAt;
                writeStdout(`[${name}] Completed successfully in ${(durationMs / 1000).toFixed(2)}s.`);
                resolve({ name, durationMs });
            } else {
                writeStderr(`[${name}] Failed with exit code ${code}.`);
                reject(new Error(`[${name}] failed`));
            }
        });
    });
}

function cleanup() {
    if (activeProcesses.length > 0) {
        writeStdout('\nCleaning up active processes...');
        activeProcesses.forEach(({ proc, name }) => {
            terminateProcessTree(proc);
            writeStdout(`- Terminated: ${name}`);
        });
    }
}

async function build() {
    const startTime = Date.now();
    writeStdout('Starting optimized build orchestration...');
    writeStdout(`[BuildMode] strict=${STRICT_BUILD} bundleBudget=${ENFORCE_BUNDLE_BUDGET}`);

    try {
        // Native build is fast and should be done first to avoid blocking others
        const results = [];
        results.push(await runCommand('node', ['scripts/compile-native.js'], 'NativeBuild'));

        // Run TypeCheck and ViteBuild in parallel, as they are the main bottlenecks
        const coreTasks = [
            runCommand('npm', ['run', 'type-check', '--', '--pretty', 'false'], 'TypeCheck'),
            runCommand('npx', ['vite', 'build'], 'ViteBuild'),
        ];

        if (STRICT_BUILD) {
            coreTasks.push(runCommand('npm', ['run', 'lint'], 'Lint'));
        } else {
            writeStdout('[Lint] Skipped for fast local build. Set TENGRA_BUILD_STRICT=true to enforce.');
        }

        const parallelResults = await Promise.all(coreTasks);
        results.push(...parallelResults);

        if (ENFORCE_BUNDLE_BUDGET) {
            results.push(await runCommand('node', ['scripts/tasks/audit-bundle-size.js'], 'BundleBudget'));
        } else {
            writeStdout('[BundleBudget] Skipped. Set TENGRA_ENFORCE_BUNDLE_BUDGET=true to enforce.');
        }

        const sortedByDuration = [...results].sort((a, b) => b.durationMs - a.durationMs);
        writeStdout('\nBuild step timings:');
        for (const result of sortedByDuration) {
            writeStdout(`- ${result.name}: ${(result.durationMs / 1000).toFixed(2)}s`);
        }

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        writeStdout(`\nBuild completed successfully in ${duration}s.`);
        process.exit(0);
    } catch (error) {
        writeStderr(`\nBuild failed: ${error.message}`);
        cleanup();
        process.exit(1);
    }
}

build();
