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
const fs = require('fs');
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

function runCommand(command, args, name, extraEnv = {}) {
    return new Promise((resolve, reject) => {
        const commandLine = [command, ...args].join(' ');
        writeStdout(`[${name}] Starting: ${commandLine}`);
        const startedAt = Date.now();
        const proc = spawn(commandLine, {
            cwd: PROJECT_ROOT,
            shell: true,
            stdio: ['ignore', 'pipe', 'pipe'],
            env: { ...process.env, ...extraEnv, FORCE_COLOR: '1' }
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

function cleanPackagingOutputs() {
    const releaseDir = path.join(PROJECT_ROOT, 'release');
    const outputDirs = ['win-unpacked', 'linux-unpacked', 'mac-unpacked'];
    for (const outputDir of outputDirs) {
        const targetPath = path.join(releaseDir, outputDir);
        if (fs.existsSync(targetPath)) {
            fs.rmSync(targetPath, { recursive: true, force: true });
        }
    }
}

async function build() {
    const startTime = Date.now();
    const ARGS = process.argv.slice(2);
    const SHOULD_PACKAGE = ARGS.includes('--package') || ARGS.includes('--publish');
    const IS_PUBLISH = ARGS.includes('--publish');

    writeStdout('Starting multi-target optimized build orchestration...');
    writeStdout(`[BuildMode] strict=${STRICT_BUILD} bundleBudget=${ENFORCE_BUNDLE_BUDGET} package=${SHOULD_PACKAGE} publish=${IS_PUBLISH}`);

    try {
        const results = [];
        
        // Sync versions across all components before building
        // Auto-increment patch version if we are publishing
        const isPublish = process.argv.includes('--publish');
        const syncArgs = ['scripts/sync-versions.js'];
        if (isPublish) {
            syncArgs.push('--increment');
        }
        
        await runCommand('node', syncArgs, 'VersionSync');

        const isFastBuild = process.env.TENGRA_BUILD_FAST === 'true';
        const coreTasks = [
            runCommand('node', ['scripts/compile-native.js'], 'NativeBuild'),
            runCommand('npx', ['vite', 'build'], 'Vite:Main', { TENGRA_BUILD_TARGET: 'main' }),
            runCommand('npx', ['vite', 'build'], 'Vite:Renderer', { TENGRA_BUILD_TARGET: 'renderer' }),
        ];

        if (!isFastBuild) {
            coreTasks.push(runCommand('npm', ['run', 'type-check', '--', '--pretty', 'false'], 'TypeCheck'));
        } else {
            writeStdout('[TypeCheck] Skipped due to TENGRA_BUILD_FAST=true');
        }

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

        // Packaging Step
        if (SHOULD_PACKAGE) {
            writeStdout('\nStarting packaging phase...');
            cleanPackagingOutputs();
            if (IS_PUBLISH) {
                // Build for all platforms in parallel where possible
                const platforms = ['--win', '--mac', '--linux'];
                const packageTasks = [];
                
                for (const platform of platforms) {
                    if (platform === '--mac' && process.platform === 'win32') {
                        writeStdout('[Package] Skipping --mac build: macOS builds are not supported on Windows without remote build services.');
                        continue;
                    }
                    
                    let targetPlatform = platform;
                    if (platform === '--linux' && process.platform === 'win32') {
                        writeStdout('[Package] Linux targets (AppImage/DEB/RPM) are not natively supported on Windows. Building Linux ZIP instead.');
                        targetPlatform = '--linux zip';
                    }

                    packageTasks.push(runCommand('npx', ['electron-builder', targetPlatform], `Package:${platform.slice(2)}`));
                }
                
                const packageResults = await Promise.all(packageTasks);
                results.push(...packageResults);
            } else {
                // Build for current platform with zero compression for speed
                const platform = process.platform === 'win32' ? '--win' : (process.platform === 'darwin' ? '--mac' : '--linux');
                writeStdout(`[Package] Building for current platform (${platform}) with high-speed compression...`);
                results.push(await runCommand('npx', ['electron-builder', platform, '--config.compression=store'], 'Package:Local'));
            }
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
