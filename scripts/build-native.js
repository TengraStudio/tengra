const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SERVICES_DIR = path.join(__dirname, '../src/services');
const TARGET_DIR = path.join(SERVICES_DIR, 'target/release');
const BIN_DIR = path.join(__dirname, '../resources/bin');

function buildNative() {
    console.log('Building native services...');

    try {
        // Ensure cargo exists
        execSync('cargo --version', { stdio: 'ignore' });
    } catch {
        console.warn('Rust toolchain not found. Skipping native build.');
        return;
    }

    try {
        // Kill existing services to prevent EBUSY errors
        console.log('Stopping running services...');
        const binaries = [
            'orbit-db-service.exe',
            'orbit-token-service.exe',
            'orbit-model-service.exe',
            'orbit-quota-service.exe',
            'orbit-memory-service.exe'
        ];

        for (const bin of binaries) {
            try {
                // /F = force, /IM = image name, 2>NUL to hide stderr
                execSync(`taskkill /F /IM ${bin} 2>NUL`, { stdio: 'ignore' });
            } catch (e) {
                // Process not running, ignore
            }
        }

        // Build workspace
        console.log('Compiling Rust binaries...');

        // Prepare command
        let buildCmd = 'cargo build --release';
        let env = { ...process.env };

        // Check if cl.exe is in PATH
        try {
            execSync('where cl.exe', { stdio: 'ignore' });
            // cl.exe found, enforce it
            env.CC = 'cl.exe';
            env.CXX = 'cl.exe';
        } catch (e) {
            console.log('cl.exe not found in PATH. Attempting to locate VS Build Tools...');

            // Known location based on user's system
            const vcvarsPath = 'C:\\Program Files\\Microsoft Visual Studio\\18\\Community\\VC\\Auxiliary\\Build\\vcvarsall.bat';

            if (fs.existsSync(vcvarsPath)) {
                console.log(`Found vcvarsall.bat at: ${vcvarsPath}`);
                // Chain the commands: setup env -> build
                // Note: We don't set CC/CXX here, relying on vcvarsall to set PATH correctly
                buildCmd = `call "${vcvarsPath}" x64 && cargo build --release`;
                // Remove CC/CXX from env to avoid confusing cc-rs if they aren't in PATH yet (though vcvars should fix it)
                delete env.CC;
                delete env.CXX;
            } else {
                console.warn('WARNING: vcvarsall.bat not found at expected location. Build may fail if cl.exe is required.');
                // Try standard fallback just in case
                env.CC = 'cl.exe';
                env.CXX = 'cl.exe';
            }
        }

        execSync(buildCmd, {
            cwd: SERVICES_DIR,
            stdio: 'inherit',
            env: env
        });

        // Create output dir
        if (!fs.existsSync(BIN_DIR)) {
            fs.mkdirSync(BIN_DIR, { recursive: true });
        }

        // Copy binaries
        // Copy binaries

        for (const bin of binaries) {
            const src = path.join(TARGET_DIR, bin);
            const dest = path.join(BIN_DIR, bin);

            if (fs.existsSync(src)) {
                fs.copyFileSync(src, dest);
                console.log(`Copied ${bin} to resources/bin`);
            } else {
                console.error(`Binary not found: ${src}`);
            }
        }

    } catch (error) {
        console.error('Failed to build native services:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    buildNative();
}
