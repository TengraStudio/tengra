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
            'tandem-db-service.exe',
            'tandem-token-service.exe',
            'tandem-model-service.exe',
            'tandem-quota-service.exe',
            'tandem-memory-service.exe'
        ];

        for (const bin of [...binaries]) {
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
                buildCmd = `call "${vcvarsPath}" x64 && cargo build --release`;
                delete env.CC;
                delete env.CXX;
            } else {
                console.warn('WARNING: vcvarsall.bat not found in common locations. Build may fail if cl.exe is required.');
                // Try standard fallback
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
