const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const { getExecutableName, getManagedRuntimeBinDir } = require('./build-runtime-paths');

const SERVICES_DIR = path.join(__dirname, '../src/native');
const TARGET_DIR = path.join(SERVICES_DIR, 'target/release');
const BIN_DIR = getManagedRuntimeBinDir();
const GO_PROXY_DIR = path.join(__dirname, '../src/services/cliproxy-runtime');
const SERVICE_BASENAMES = ['db-service', 'token-service', 'model-service', 'quota-service', 'memory-service'];

function resolveCargoCommand() {
    const localCargo = process.platform === 'win32' 
        ? path.join(process.env.USERPROFILE || '', '.cargo', 'bin', 'cargo.exe')
        : path.join(process.env.HOME || '', '.cargo', 'bin', 'cargo');
    if (fs.existsSync(localCargo)) {
        return `"${localCargo}"`;
    }
    return 'cargo';
}

function copyWithRetry(src, dest) {
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
            console.log(`Copy error: ${e.code || e.message}`);
            if (e.code === 'EBUSY' || e.code === 'EPERM') {
                if (retries <= 1) throw e;
                console.log(`File locked, retrying copy in 2s: ${path.basename(dest)}`);
                // Sync sleep 2s
                const end = Date.now() + 2000;
                while (Date.now() < end);
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
}

function getNativeBinaryMappings() {
    return SERVICE_BASENAMES.map(base => {
        const output = getExecutableName(`tengra-${base}`);
        return { output };
    });
}

function copyNativeBinariesFromTarget() {
    ensureBinDir();
    const mappings = getNativeBinaryMappings();
    const missingBinaries = [];

    for (const mapping of mappings) {
        const src = path.join(TARGET_DIR, mapping.output);
        const dest = path.join(BIN_DIR, mapping.output);

        if (!fs.existsSync(src)) {
            missingBinaries.push(src);
            continue;
        }

        copyWithRetry(src, dest);
        console.log(`Copied ${mapping.output} to managed runtime bin`);
    }

    if (missingBinaries.length > 0) {
        throw new Error(
            `Missing required tengra binaries after Rust build:\n${missingBinaries.join('\n')}`
        );
    }
}

function buildGoProxy() {
    console.log('Building Go proxy server...');

    try {
        // Check if Go is installed
        execSync('go version', { stdio: 'ignore' });
    } catch {
        console.warn('Go toolchain not found. Skipping Go proxy build.');
        return;
    }

    try {
        // Kill existing proxy process
        try {
            if (process.platform === 'win32') {
                execSync(`taskkill /F /IM ${getExecutableName('cliproxy-embed')} 2>NUL`, { stdio: 'ignore' });
            } else {
                execSync('pkill -9 -f cliproxy-embed', { stdio: 'ignore' });
            }
        } catch {
            // Process not running, ignore
        }

        // Build the runtime-backed proxy binary using the stable cliproxy-embed filename.
        console.log('Compiling Go proxy binary...');
        const embedDir = GO_PROXY_DIR;
        const proxyBinaryName = getExecutableName('cliproxy-embed');

        execSync(`go build -o ${proxyBinaryName}`, {
            cwd: embedDir,
            stdio: 'inherit'
        });

        // Create output dir if needed
        ensureBinDir();

        // Copy binary to the managed runtime directory
        const src = path.join(embedDir, proxyBinaryName);
        const dest = path.join(BIN_DIR, proxyBinaryName);

        if (fs.existsSync(src)) {
            copyWithRetry(src, dest);
            console.log(`Copied ${proxyBinaryName} to managed runtime bin`);
        } else {
            console.error(`Go binary not found: ${src}`);
        }

    } catch (error) {
        console.error('Failed to build Go proxy:', error);
        // Don't exit - Go proxy is optional for dev
    }
}

function buildNative() {
    console.log('Building native services...');
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

    try {
        // Kill existing services to prevent EBUSY errors
        console.log('Stopping running services...');
        for (const mapping of mappings) {
            try {
                if (process.platform === 'win32') {
                    execSync(`taskkill /F /IM ${mapping.output} 2>NUL`, { stdio: 'ignore' });
                } else {
                    const processName = mapping.output.replace(/\.exe$/i, '');
                    execSync(`pkill -9 -f ${processName}`, { stdio: 'ignore' });
                }
            } catch {
                // Process not running, ignore
            }
        }

        // Wait for processes to release locks
        const end = Date.now() + 1000;
        while (Date.now() < end);

        // Build workspace
        console.log('Compiling Rust binaries...');

        // Prepare command
        let buildCmd = `${cargoCommand} build --release`;
        let env = { ...process.env };

        if (process.platform === 'win32') {
        try {
            execSync('where cl.exe', { stdio: 'ignore' });
            // cl.exe found, enforce it
            env.CC = 'cl.exe';
            env.CXX = 'cl.exe';
        } catch (e) {
            console.log('cl.exe not found in PATH. Attempting to locate VS Build Tools...');

            // Try to locate vcvarsall.bat in common locations
            const commonPaths = [
                'C:\\Program Files\\Microsoft Visual Studio\\2025\\Community\\VC\\Auxiliary\\Build\\vcvarsall.bat',
                'C:\\Program Files\\Microsoft Visual Studio\\2025\\Professional\\VC\\Auxiliary\\Build\\vcvarsall.bat',
                'C:\\Program Files\\Microsoft Visual Studio\\2025\\Enterprise\\VC\\Auxiliary\\Build\\vcvarsall.bat',
                'C:\\Program Files\\Microsoft Visual Studio\\2025\\BuildTools\\VC\\Auxiliary\\Build\\vcvarsall.bat',
                'C:\\Program Files\\Microsoft Visual Studio\\18\\Community\\VC\\Auxiliary\\Build\\vcvarsall.bat',
                'C:\\Program Files\\Microsoft Visual Studio\\18\\Professional\\VC\\Auxiliary\\Build\\vcvarsall.bat',
                'C:\\Program Files\\Microsoft Visual Studio\\18\\Enterprise\\VC\\Auxiliary\\Build\\vcvarsall.bat',
                'C:\\Program Files\\Microsoft Visual Studio\\18\\BuildTools\\VC\\Auxiliary\\Build\\vcvarsall.bat',
                'C:\\Program Files\\Microsoft Visual Studio\\2022\\Community\\VC\\Auxiliary\\Build\\vcvarsall.bat',
                'C:\\Program Files\\Microsoft Visual Studio\\2022\\Professional\\VC\\Auxiliary\\Build\\vcvarsall.bat',
                'C:\\Program Files\\Microsoft Visual Studio\\2022\\Enterprise\\VC\\Auxiliary\\Build\\vcvarsall.bat',
                'C:\\Program Files\\Microsoft Visual Studio\\2022\\BuildTools\\VC\\Auxiliary\\Build\\vcvarsall.bat',
                'C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\Community\\VC\\Auxiliary\\Build\\vcvarsall.bat',
                'C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\Professional\\VC\\Auxiliary\\Build\\vcvarsall.bat',
                'C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\Enterprise\\VC\\Auxiliary\\Build\\vcvarsall.bat',
                'C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\BuildTools\\VC\\Auxiliary\\Build\\vcvarsall.bat'
            ];

            let vcvarsPath = commonPaths.find(p => fs.existsSync(p));

            if (vcvarsPath) {
                console.log(`Found vcvarsall.bat at: ${vcvarsPath}`);
                // Chain the commands: setup env -> build
                buildCmd = `call "${vcvarsPath}" x64 && ${cargoCommand} build --release`;
                delete env.CC;
                delete env.CXX;
            } else {
                console.warn('WARNING: vcvarsall.bat not found in common locations. Build may fail if cl.exe is required.');
                // Try standard fallback
                env.CC = 'cl.exe';
                env.CXX = 'cl.exe';
            }
        }
        }

        execSync(buildCmd, {
            cwd: SERVICES_DIR,
            stdio: 'inherit',
            env: env
        });

        copyNativeBinariesFromTarget();

    } catch (error) {
        console.error('Failed to build native services:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    buildNative();
    buildGoProxy();
}


