/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const { getExecutableName, getManagedRuntimeBinDir, getBuildBinDir } = require('./build-runtime-paths');

const SERVICES_DIR = path.join(__dirname, '../src/native');
const TARGET_DIR = path.join(SERVICES_DIR, 'target/release');
const STAMP_FILE = path.join(SERVICES_DIR, 'target', 'native-build-stamp.json');
const BIN_DIR = getManagedRuntimeBinDir();
const BUILD_BIN_DIR = getBuildBinDir();
const SERVICE_BASENAMES = ['db-service', 'memory-service', 'proxy'];
const ALLOW_LOCKED_NATIVE_SKIP = process.env.CI !== 'true' && process.env.TENGRA_ALLOW_LOCKED_NATIVE_SKIP !== 'false';

function writeStdout(message) {
    process.stdout.write(`${message}\n`);
}

function writeStderr(message) {
    process.stderr.write(`${message}\n`);
}

function nowMs() {
    return Date.now();
}

/**
 * Async-friendly delay function.
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function stopProcessByName(processName) {
    if (process.platform !== 'win32') {
        return;
    }

    try {
        execSync(
            `powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-Process -Name '${processName}' -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.Id -Force }"`,
            { stdio: 'ignore' }
        );
    } catch {
        // Process may not exist; ignore.
    }
}

function resolveCargoCommand() {
    const localCargo = process.platform === 'win32' 
        ? path.join(process.env.USERPROFILE || '', '.cargo', 'bin', 'cargo.exe')
        : path.join(process.env.HOME || '', '.cargo', 'bin', 'cargo');
    if (fs.existsSync(localCargo)) {
        return `"${localCargo}"`;
    }
    return 'cargo';
}

async function copyWithRetry(src, dest, outputName) {
    const processName = outputName.replace(/\.exe$/i, '');
    let retries = 10;
    while (retries > 0) {
        try {
            // Try to delete destination first to avoid lock issues
            if (fs.existsSync(dest)) {
                try {
                    fs.unlinkSync(dest);
                } catch (e) {
                    // If delete fails, it might be locked, let the copy try or fail
                    if (e.code !== 'ENOENT') {
                        // Ignore unlink error, copyFileSync might still fail or succeed
                    }
                }
            }
            fs.copyFileSync(src, dest);
            return;
        } catch (e) {
            if (e.code === 'EBUSY' || e.code === 'EPERM') {
                if (retries <= 1) throw e;
                stopProcessByName(processName);
                const waitMs = 250 * Math.pow(2, 10 - retries);
                writeStdout(`File locked, retrying copy in ${waitMs}ms: ${path.basename(dest)}`);
                await delay(waitMs);
                retries--;
                continue;
            }
            throw e;
        }
    }
}

function ensureBinDir() {
    if (!fs.existsSync(BIN_DIR)) {
        fs.mkdirSync(BIN_DIR, { recursive: true });
    }
    if (!fs.existsSync(BUILD_BIN_DIR)) {
        fs.mkdirSync(BUILD_BIN_DIR, { recursive: true });
    }
}

function getNativeBinaryMappings() {
    return SERVICE_BASENAMES.map(base => {
        const output = getExecutableName(`tengra-${base}`);
        return { output };
    });
}

function collectNativeSourceMetadata(rootDir) {
    const entries = [];
    const queue = [rootDir];

    while (queue.length > 0) {
        const currentDir = queue.pop();
        const children = fs.readdirSync(currentDir, { withFileTypes: true });

        for (const child of children) {
            if (child.name === 'target' || child.name === '.git') {
                continue;
            }

            const absolutePath = path.join(currentDir, child.name);
            if (child.isDirectory()) {
                queue.push(absolutePath);
                continue;
            }

            const relativePath = path.relative(SERVICES_DIR, absolutePath);
            if (!/\.(rs|toml|lock)$/.test(relativePath)) {
                continue;
            }

            const stat = fs.statSync(absolutePath);
            entries.push(`${relativePath}:${stat.size}:${Math.trunc(stat.mtimeMs)}`);
        }
    }

    return entries.sort();
}

function computeNativeBuildStamp() {
    return JSON.stringify(collectNativeSourceMetadata(SERVICES_DIR));
}

function hasCurrentNativeBuildOutputs(mappings) {
    return mappings.every(mapping => fs.existsSync(path.join(TARGET_DIR, mapping.output)));
}

function shouldSkipNativeBuild(mappings) {
    if (!fs.existsSync(STAMP_FILE) || !hasCurrentNativeBuildOutputs(mappings)) {
        return false;
    }

    try {
        const stored = JSON.parse(fs.readFileSync(STAMP_FILE, 'utf8'));
        return stored.stamp === computeNativeBuildStamp();
    } catch {
        return false;
    }
}

function persistNativeBuildStamp() {
    fs.mkdirSync(path.dirname(STAMP_FILE), { recursive: true });
    fs.writeFileSync(
        STAMP_FILE,
        JSON.stringify({ stamp: computeNativeBuildStamp() }, null, 2),
        'utf8'
    );
}

async function copyNativeBinariesFromTarget() {
    ensureBinDir();
    const mappings = getNativeBinaryMappings();
    const missingBinaries = [];

    const copyTasks = mappings.map(async (mapping) => {
        const src = path.join(TARGET_DIR, mapping.output);
        const dest = path.join(BIN_DIR, mapping.output);
        const buildDest = path.join(BUILD_BIN_DIR, mapping.output);

        if (!fs.existsSync(src)) {
            missingBinaries.push(src);
            return;
        }

        try {
            await Promise.all([
                copyWithRetry(src, dest, mapping.output),
                copyWithRetry(src, buildDest, mapping.output)
            ]);
            writeStdout(`Copied ${mapping.output} to runtime and build bin`);
        } catch (error) {
            const maybeError = error;
            const code = maybeError && typeof maybeError === 'object' ? maybeError.code : undefined;
            if (
                ALLOW_LOCKED_NATIVE_SKIP
                && fs.existsSync(dest)
                && (code === 'EBUSY' || code === 'EPERM')
            ) {
                writeStderr(
                    `Warning: ${mapping.output} is locked. Keeping existing binary.`
                );
                return;
            }
            throw error;
        }
    });

    await Promise.all(copyTasks);

    if (missingBinaries.length > 0) {
        throw new Error(
            `Missing required tengra binaries after Rust build:\n${missingBinaries.join('\n')}`
        );
    }
}

/**
 * Optimized Visual Studio environment discovery with caching.
 */
let cachedVcvarsPath = null;
function findVcvarsPath() {
    if (cachedVcvarsPath) return cachedVcvarsPath;

    // Try vswhere first (Modern way)
    try {
        const vswherePath = path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Microsoft Visual Studio', 'Installer', 'vswhere.exe');
        if (fs.existsSync(vswherePath)) {
            const vsInstallPath = execSync(`"${vswherePath}" -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
            if (vsInstallPath) {
                const vcvars = path.join(vsInstallPath, 'VC', 'Auxiliary', 'Build', 'vcvarsall.bat');
                if (fs.existsSync(vcvars)) {
                    cachedVcvarsPath = vcvars;
                    return cachedVcvarsPath;
                }
            }
        }
    } catch {
        // Ignore and fall back to common paths
    }

    const commonPaths = [
        'C:\\Program Files\\Microsoft Visual Studio\\2025\\Community\\VC\\Auxiliary\\Build\\vcvarsall.bat',
        'C:\\Program Files\\Microsoft Visual Studio\\2025\\Professional\\VC\\Auxiliary\\Build\\vcvarsall.bat',
        'C:\\Program Files\\Microsoft Visual Studio\\2025\\Enterprise\\VC\\Auxiliary\\Build\\vcvarsall.bat',
        'C:\\Program Files\\Microsoft Visual Studio\\2025\\BuildTools\\VC\\Auxiliary\\Build\\vcvarsall.bat',
        'C:\\Program Files\\Microsoft Visual Studio\\2022\\Community\\VC\\Auxiliary\\Build\\vcvarsall.bat',
        'C:\\Program Files\\Microsoft Visual Studio\\2022\\Professional\\VC\\Auxiliary\\Build\\vcvarsall.bat',
        'C:\\Program Files\\Microsoft Visual Studio\\2022\\Enterprise\\VC\\Auxiliary\\Build\\vcvarsall.bat',
        'C:\\Program Files\\Microsoft Visual Studio\\2022\\BuildTools\\VC\\Auxiliary\\Build\\vcvarsall.bat',
        'C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\Community\\VC\\Auxiliary\\Build\\vcvarsall.bat',
        'C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\Professional\\VC\\Auxiliary\\Build\\vcvarsall.bat',
        'C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\Enterprise\\VC\\Auxiliary\\Build\\vcvarsall.bat',
        'C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\BuildTools\\VC\\Auxiliary\\Build\\vcvarsall.bat',
        'C:\\Program Files (x86)\\Microsoft Visual Studio\\18\\BuildTools\\VC\\Auxiliary\\Build\\vcvarsall.bat'
    ];

    cachedVcvarsPath = commonPaths.find(p => fs.existsSync(p));
    return cachedVcvarsPath;
}

async function buildNative() {
    const buildStart = nowMs();
    writeStdout('Building native services...');
    const mappings = getNativeBinaryMappings();
    const cargoCommand = resolveCargoCommand();

    try {
        // Ensure cargo exists
        execSync(`${cargoCommand} --version`, { stdio: 'ignore' });
    } catch {
        throw new Error(
            'Rust toolchain not found. Native services must be built to produce tengra-* executables.'
        );
    }

    if (shouldSkipNativeBuild(mappings)) {
        writeStdout('Skipping Rust rebuild; native sources unchanged.');
        await copyNativeBinariesFromTarget();
        writeStdout(`Native step finished in ${((nowMs() - buildStart) / 1000).toFixed(2)}s.`);
        return;
    }

    try {
        // Kill existing services to prevent EBUSY errors in parallel
        writeStdout('Stopping running services...');
        const stopTasks = mappings.map(mapping => {
            const processName = mapping.output.replace(/\.exe$/i, '');
            if (process.platform === 'win32') {
                return new Promise(resolve => {
                    spawn('powershell', ['-NoProfile', '-Command', `Get-Process -Name '${processName}' -ErrorAction SilentlyContinue | Stop-Process -Force`], { stdio: 'ignore' })
                        .on('close', resolve);
                });
            } else {
                return new Promise(resolve => {
                    spawn('pkill', ['-9', '-f', processName], { stdio: 'ignore' })
                        .on('close', resolve);
                });
            }
        });
        await Promise.all(stopTasks);

        // Wait for processes to release locks
        await delay(500);

        // Build workspace
        writeStdout('Compiling Rust binaries...');

        // Prepare command
        let buildCmd = `${cargoCommand} build --release`;
        let env = { ...process.env };

        if (process.platform === 'win32') {
            try {
                execSync('where cl.exe', { stdio: 'ignore' });
                env.CC = 'cl.exe';
                env.CXX = 'cl.exe';
            } catch (e) {
                const vcvarsPath = findVcvarsPath();
                if (vcvarsPath) {
                    writeStdout(`Found vcvarsall.bat at: ${vcvarsPath}`);
                    buildCmd = `call "${vcvarsPath}" x64 && ${cargoCommand} build --release`;
                    delete env.CC;
                    delete env.CXX;
                } else {
                    writeStderr('WARNING: vcvarsall.bat not found. Build may fail if cl.exe is required.');
                    env.CC = 'cl.exe';
                    env.CXX = 'cl.exe';
                }
            }
        }

        // Run the build process
        const buildProc = spawn(buildCmd, {
            cwd: SERVICES_DIR,
            stdio: 'inherit',
            shell: true,
            env: env
        });

        await new Promise((resolve, reject) => {
            buildProc.on('close', code => code === 0 ? resolve() : reject(new Error(`Cargo build failed with code ${code}`)));
            buildProc.on('error', reject);
        });

        persistNativeBuildStamp();
        await copyNativeBinariesFromTarget();
        writeStdout(`Native step finished in ${((nowMs() - buildStart) / 1000).toFixed(2)}s.`);

    } catch (error) {
        writeStderr(`Failed to build native services: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
    }
}

if (require.main === module) {
    buildNative();
}
