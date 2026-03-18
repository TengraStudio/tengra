const { spawn } = require('child_process');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');

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
function runCommand(command, args, name) {
    return new Promise((resolve, reject) => {
        const commandLine = [command, ...args].join(' ');
        writeStdout(`[${name}] Starting: ${commandLine}`);
        const proc = spawn(commandLine, {
            cwd: PROJECT_ROOT,
            shell: true,
            stdio: 'inherit',
            env: { ...process.env, FORCE_COLOR: '1' }
        });

        proc.on('error', (error) => {
            writeStderr(`[${name}] Failed to start: ${error.message}`);
            reject(error);
        });

        proc.on('close', (code) => {
            if (code === 0) {
                writeStdout(`[${name}] Completed successfully.`);
                resolve();
            } else {
                writeStderr(`[${name}] Failed with exit code ${code}.`);
                reject(new Error(`[${name}] failed`));
            }
        });
    });
}

async function build() {
    const startTime = Date.now();
    writeStdout('Starting optimized parallel build...');

    try {
        // Run tsc, lint, and vite build in parallel
        // We also run native build in parallel since it focuses on Rust/Go and the managed runtime,
        // while Vite focuses on src/ and dist/
        await Promise.all([
            runCommand('npx', ['tsc'], 'TypeCheck'),
            runCommand('npm', ['run', 'lint'], 'Lint'),
            runCommand('npx', ['vite', 'build'], 'ViteBuild'),
            runCommand('node', ['scripts/compile-native.js'], 'NativeBuild')
        ]);
        
        await runCommand('node', ['scripts/audit-bundle-size.js'], 'BundleBudget');

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        writeStdout(`\nBuild completed successfully in ${duration}s.`);
    } catch (error) {
        writeStderr('\nBuild failed.');
        process.exit(1);
    }
}

build();
