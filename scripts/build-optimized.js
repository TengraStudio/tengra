const { spawn } = require('child_process');
const path = require('path');

/**
 * Runs a command and returns a promise that resolves when the command completes.
 * @param {string} command The command to run.
 * @param {string[]} args The arguments for the command.
 * @param {string} name A label for the command output.
 * @returns {Promise<void>}
 */
function runCommand(command, args, name) {
    return new Promise((resolve, reject) => {
        console.log(`[${name}] Starting: ${command} ${args.join(' ')}`);
        const proc = spawn(command, args, {
            shell: true,
            stdio: 'inherit',
            env: { ...process.env, FORCE_COLOR: '1' }
        });

        proc.on('close', (code) => {
            if (code === 0) {
                console.log(`[${name}] Completed successfully.`);
                resolve();
            } else {
                console.error(`[${name}] Failed with exit code ${code}.`);
                reject(new Error(`[${name}] failed`));
            }
        });
    });
}

async function build() {
    const startTime = Date.now();
    console.log('Starting optimized parallel build...');

    try {
        // Run tsc, lint, and vite build in parallel
        // We also run native build in parallel since it focuses on Rust/Go and the managed runtime,
        // while Vite focuses on src/ and dist/
        await Promise.all([
            runCommand('npx', ['tsc'], 'TypeCheck'),
            runCommand('npm', ['run', 'lint'], 'Lint'),
            runCommand('npx', ['vite', 'build'], 'ViteBuild'),
            runCommand('node', ['scripts/build-native.js'], 'NativeBuild')
        ]);

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`\n✅ Build completed successfully in ${duration}s!`);
    } catch (error) {
        console.error('\n❌ Build failed!');
        process.exit(1);
    }
}

build();
