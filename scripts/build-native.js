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
        execSync('cargo build --release', {
            cwd: SERVICES_DIR,
            stdio: 'inherit'
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
