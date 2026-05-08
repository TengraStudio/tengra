/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');

const HOST_PLATFORM = process.platform;
const HOST_ARCH = process.arch;

const STRICT_BUILD = process.env.CI === 'true' || process.env.TENGRA_BUILD_STRICT === 'true';
const ENFORCE_BUNDLE_BUDGET = process.env.CI === 'true' || process.env.TENGRA_ENFORCE_BUNDLE_BUDGET === 'true';

const PLATFORM_FLAGS = {
    win32: '--win',
    darwin: '--mac',
    linux: '--linux',
};

const PLATFORM_NAMES = {
    '--win': 'win',
    '--mac': 'mac',
    '--linux': 'linux',
};

const VALID_PLATFORM_FLAGS = new Set(['--win', '--mac', '--linux']);
const VALID_ARCH_FLAGS = new Set(['--x64', '--arm64', '--ia32']);

let activeProcesses = [];

function stdout(message = '') {
    process.stdout.write(`${message}\n`);
}

function stderr(message = '') {
    process.stderr.write(`${message}\n`);
}

function getHostPlatformFlag() {
    return PLATFORM_FLAGS[HOST_PLATFORM] || '--linux';
}

function getHostArchFlag() {
    if (HOST_ARCH === 'arm64') return '--arm64';
    if (HOST_ARCH === 'ia32') return '--ia32';
    return '--x64';
}

function parseArgs(argv) {
    const args = new Set(argv);

    const selectedPlatforms = argv.filter(arg => VALID_PLATFORM_FLAGS.has(arg));
    const selectedArchs = argv.filter(arg => VALID_ARCH_FLAGS.has(arg));

    return {
        shouldPackage: args.has('--package') || args.has('--publish'),
        isPublish: args.has('--publish'),
        all: args.has('--all'),
        fast: args.has('--fast') || process.env.TENGRA_BUILD_FAST === 'true',
        skipNative: args.has('--skip-native'),
        skipVite: args.has('--skip-vite'),
        skipTypecheck: args.has('--skip-typecheck'),
        skipLint: args.has('--skip-lint'),
        skipBudget: args.has('--skip-budget'),
        allowCrossPlatform: args.has('--allow-cross-platform'),
        rebuildNativeModules: args.has('--rebuild-native-modules'),
        platforms: selectedPlatforms.length > 0 ? selectedPlatforms : null,
        archs: selectedArchs.length > 0 ? selectedArchs : [getHostArchFlag()],
    };
}

function loadDotEnv() {
    const envPath = path.join(PROJECT_ROOT, '.env');
    if (!fs.existsSync(envPath)) {
        return;
    }

    try {
        const content = fs.readFileSync(envPath, 'utf8');
        const lines = content.split('\n');

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) {
                continue;
            }

            const equalsIndex = trimmed.indexOf('=');
            if (equalsIndex > 0) {
                const key = trimmed.slice(0, equalsIndex).trim();
                let value = trimmed.slice(equalsIndex + 1).trim();

                // Remove quotes if present
                if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                    value = value.slice(1, -1);
                }

                if (!process.env[key]) {
                    process.env[key] = value;
                }
            }
        }
    } catch (error) {
        stderr(`[DotEnv] Warning: Failed to load .env file: ${error.message}`);
    }
}

function assertPublishCredentialsAvailable(options) {
    if (!options.isPublish) {
        return;
    }

    // Try loading from .env if not already in process.env
    if (!process.env.GH_TOKEN && !process.env.GITHUB_TOKEN) {
        loadDotEnv();
    }

    if (process.env.GH_TOKEN || process.env.GITHUB_TOKEN) {
        return;
    }

    throw new Error(
        'Publish requested, but GH_TOKEN/GITHUB_TOKEN is not available in the process environment or .env file.'
    );
}

function terminateProcessTree(proc) {
    if (!proc || proc.killed) {
        return;
    }

    if (process.platform === 'win32') {
        const killer = spawn('taskkill', ['/PID', String(proc.pid), '/T', '/F'], {
            stdio: 'ignore',
            windowsHide: true,
        });

        killer.on('error', () => undefined);
        return;
    }

    try {
        process.kill(proc.pid, 'SIGTERM');
    } catch {
        // ignore
    }
}

function cleanup() {
    if (activeProcesses.length === 0) {
        return;
    }

    stdout('\nCleaning up active processes...');

    for (const { proc, name } of activeProcesses) {
        terminateProcessTree(proc);
        stdout(`- Terminated: ${name}`);
    }
}

function resolveNodeCliCommand(command, args) {
    if (command === 'npx' && args[0] === 'vite') {
        return {
            command: process.execPath,
            args: [path.join(PROJECT_ROOT, 'node_modules', 'vite', 'bin', 'vite.js'), ...args.slice(1)],
        };
    }

    if (command === 'npm') {
        const npmCli = process.env.npm_execpath;
        if (npmCli && fs.existsSync(npmCli)) {
            return { command: process.execPath, args: [npmCli, ...args] };
        }
    }

    if (command === 'npx') {
        const npmCli = process.env.npm_execpath;
        const npxCli = npmCli ? path.join(path.dirname(npmCli), 'npx-cli.js') : '';
        if (npxCli && fs.existsSync(npxCli)) {
            return { command: process.execPath, args: [npxCli, ...args] };
        }
    }

    return { command, args };
}

function runCommand(command, args, name, extraEnv = {}) {
    return new Promise((resolve, reject) => {
        const startedAt = Date.now();

        stdout(`[${name}] Starting: ${command} ${args.join(' ')}`);

        let settled = false;

        const resolved = resolveNodeCliCommand(command, args);
        const proc = spawn(resolved.command, resolved.args, {
            cwd: PROJECT_ROOT,
            shell: false,
            stdio: ['ignore', 'pipe', 'pipe'],
            env: {
                ...process.env,
                ...extraEnv,
                FORCE_COLOR: '1',
            },
            windowsHide: true,
        });

        activeProcesses.push({ proc, name });

        proc.stdout?.on('data', chunk => process.stdout.write(chunk));
        proc.stderr?.on('data', chunk => process.stderr.write(chunk));

        proc.on('error', error => {
            if (settled) return;
            settled = true;

            activeProcesses = activeProcesses.filter(item => item.proc !== proc);
            reject(new Error(`[${name}] spawn failed: ${error.message}`));
        });

        proc.on('close', code => {
            if (settled) return;
            settled = true;

            activeProcesses = activeProcesses.filter(item => item.proc !== proc);

            if (code === 0) {
                const durationMs = Date.now() - startedAt;
                stdout(`[${name}] Completed in ${(durationMs / 1000).toFixed(2)}s.`);
                resolve({ name, durationMs });
                return;
            }

            reject(new Error(`[${name}] failed with exit code ${code}`));
        });
    });
}

function cleanPackagingOutputs() {
    const releaseDir = path.join(PROJECT_ROOT, 'release');

    if (!fs.existsSync(releaseDir)) {
        return;
    }

    const removableNames = [
        'win-unpacked',
        'linux-unpacked',
        'mac',
        'mac-arm64',
        'mac-universal',
        'builder-debug.yml',
        'builder-effective-config.yaml',
    ];

    for (const name of removableNames) {
        const targetPath = path.join(releaseDir, name);

        if (fs.existsSync(targetPath)) {
            try {
                // Try to remove with retries for Windows stability
                let attempts = 0;
                while (attempts < 3) {
                    try {
                        fs.rmSync(targetPath, { recursive: true, force: true });
                        break;
                    } catch (e) {
                        attempts++;
                        if (attempts >= 3) { throw e; }
                        // Wait a bit for file locks to release
                        const syncWait = (ms) => {
                            const start = Date.now();
                            while (Date.now() - start < ms) { /* wait */ }
                        };
                        syncWait(500);
                    }
                }
            } catch (error) {
                // Don't crash the whole build for a cleanup failure
                // electron-builder will likely handle it or fail with a better error
                stdout(`[Cleanup] Warning: Could not remove ${name}: ${error.message}`);
            }
        }
    }
}

function resolvePackagePlatforms(options) {
    if (options.all) {
        return ['--win', '--mac', '--linux'];
    }

    if (options.platforms) {
        return options.platforms;
    }

    return [getHostPlatformFlag()];
}

function isCrossPlatformTarget(platformFlag) {
    return platformFlag !== getHostPlatformFlag();
}

function validatePackageTarget(platformFlag, options) {
    if (!isCrossPlatformTarget(platformFlag)) {
        return true;
    }

    if (options.allowCrossPlatform) {
        return true;
    }

    const targetName = PLATFORM_NAMES[platformFlag];

    stderr(
        `[Package:${targetName}] Skipped: cross-platform packaging is disabled by default because this project has native modules.`
    );
    stderr(
        `[Package:${targetName}] Use --allow-cross-platform only if native binaries and Node native modules already exist for that target.`
    );

    return false;
}

function getElectronBuilderArgs(platformFlag, archFlag, options) {
    const args = [
        'electron-builder',
        platformFlag,
        archFlag,
        '--config.compression=store',
    ];

    /**
     * Faster packaging.
     *
     * bufferutil/native modules should already be prepared by:
     * npm install / postinstall / electron-builder install-app-deps
     *
     * If you need electron-builder to rebuild native modules during packaging:
     * node scripts/build-all.js --package --rebuild-native-modules
     */
    if (!options.rebuildNativeModules) {
        args.push('--config.npmRebuild=false');
    }

    if (options.isPublish) {
        args.push('--publish=always');
    }

    if (platformFlag === '--linux' && HOST_PLATFORM === 'win32') {
        args.push('--config.linux.target=zip');
    }

    return args;
}

async function runCoreBuild(options) {
    const results = [];

    const syncArgs = ['scripts/sync-versions.js'];

    if (options.isPublish) {
        syncArgs.push('--increment');
    }

    results.push(await runCommand('node', syncArgs, 'VersionSync'));

    const tasks = [];

    if (!options.skipNative) {
        tasks.push(runCommand('node', ['scripts/compile-native.js'], 'NativeBuild'));
    } else {
        stdout('[NativeBuild] Skipped.');
    }

    if (!options.skipVite) {
        tasks.push(runCommand('npx', ['vite', 'build'], 'Vite:Main', {
            TENGRA_BUILD_TARGET: 'main',
        }));

        tasks.push(runCommand('npx', ['vite', 'build'], 'Vite:Renderer', {
            TENGRA_BUILD_TARGET: 'renderer',
        }));
    } else {
        stdout('[Vite] Skipped.');
    }

    if (!options.fast && !options.skipTypecheck) {
        tasks.push(runCommand('npm', ['run', 'type-check', '--', '--pretty', 'false'], 'TypeCheck'));
    } else {
        stdout('[TypeCheck] Skipped.');
    }

    if (STRICT_BUILD && !options.skipLint) {
        tasks.push(runCommand('npm', ['run', 'lint'], 'Lint'));
    } else {
        stdout('[Lint] Skipped.');
    }

    const parallelResults = await Promise.all(tasks);
    results.push(...parallelResults);

    if (ENFORCE_BUNDLE_BUDGET && !options.skipBudget) {
        results.push(await runCommand('node', ['scripts/tasks/audit-bundle-size.js'], 'BundleBudget'));
    } else {
        stdout('[BundleBudget] Skipped.');
    }

    return results;
}

async function runPackaging(options) {
    const results = [];
    const platforms = resolvePackagePlatforms(options);

    cleanPackagingOutputs();

    stdout('');
    stdout(`[Package] Platforms: ${platforms.join(', ')}`);
    stdout(`[Package] Architectures: ${options.archs.join(', ')}`);

    for (const platformFlag of platforms) {
        if (!validatePackageTarget(platformFlag, options)) {
            continue;
        }

        for (const archFlag of options.archs) {
            const platformName = PLATFORM_NAMES[platformFlag];
            const archName = archFlag.replace('--', '');
            const name = `Package:${platformName}:${archName}`;
            const args = getElectronBuilderArgs(platformFlag, archFlag, options);

            results.push(await runCommand('npx', args, name));
        }
    }

    return results;
}

function printTimings(results) {
    if (results.length === 0) {
        return;
    }

    stdout('');
    stdout('Build step timings:');

    const sorted = [...results].sort((a, b) => b.durationMs - a.durationMs);

    for (const result of sorted) {
        stdout(`- ${result.name}: ${(result.durationMs / 1000).toFixed(2)}s`);
    }
}

async function main() {
    const startedAt = Date.now();
    const options = parseArgs(process.argv.slice(2));
    const results = [];

    stdout('Starting Tengra build...');
    stdout(`Host: ${HOST_PLATFORM}/${HOST_ARCH}`);
    stdout(`Mode: package=${options.shouldPackage} publish=${options.isPublish} fast=${options.fast}`);

    try {
        assertPublishCredentialsAvailable(options);
        results.push(...await runCoreBuild(options));

        if (options.shouldPackage) {
            results.push(...await runPackaging(options));
        }

        if (options.isPublish) {
            results.push(await runCommand('node', ['scripts/publish-manifest.js'], 'PublishManifest'));
        }

        printTimings(results);

        const duration = ((Date.now() - startedAt) / 1000).toFixed(2);
        stdout('');
        stdout(`Build completed successfully in ${duration}s.`);
        process.exit(0);
    } catch (error) {
        stderr('');
        stderr(`Build failed: ${error.message}`);
        cleanup();
        process.exit(1);
    }
}

process.on('SIGINT', () => {
    cleanup();
    process.exit(130);
});

process.on('SIGTERM', () => {
    cleanup();
    process.exit(143);
});

main();
