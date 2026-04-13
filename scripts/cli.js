/**
 * Tengra Project Tooling Dispatcher
 * Consolidates secondary scripts to keep package.json clean.
 */
const { spawnSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const command = process.argv[2];
const subCommand = process.argv[3];
const args = process.argv.slice(4);

const SCRIPT_MAP = {
    perf: {
        startup: 'node scripts/tasks/perf-startup.js',
        budget: 'node scripts/tasks/audit-bundle-size.js',
        contract: 'node scripts/tasks/audit-perf-contract.js',
        ci: 'npm run tool perf:startup && npm run tool perf:budget',
    },
    gh: {
        cleanup: 'node scripts/tasks/gh-workflow-cleanup.js',
    },
    secrets: {
        scan: 'secretlint --secretlintignore .secretlintignore "**/*"',
    },
    verify: {
        all: '', // Special handling in runVerify
        full: 'npm run tool verify && npm run tool perf:contract',
    }
};

async function runVerify() {
    const startTime = Date.now();
    console.log('\x1b[36m> Starting parallel verification (Lint, TypeCheck, Test)...\x1b[0m');
    
    const run = (cmd, args, name) => new Promise((resolve, reject) => {
        const proc = spawn(cmd, args, { shell: true, stdio: 'inherit', env: { ...process.env, FORCE_COLOR: '1' } });
        proc.on('close', code => code === 0 ? resolve() : reject(new Error(`${name} failed`)));
    });

    try {
        await Promise.all([
            run('npm', ['run', 'lint'], 'Lint'),
            run('npm', ['run', 'type-check'], 'TypeCheck'),
            run('npm', ['run', 'test'], 'Test')
        ]);
        console.log(`\n\x1b[32m✅ Verification completed successfully in ${((Date.now() - startTime) / 1000).toFixed(2)}s!\x1b[0m`);
    } catch (e) {
        console.error(`\n\x1b[31m❌ Verification failed: ${e.message}\x1b[0m`);
        process.exit(1);
    }
}

function run(cmdString) {
    if (!cmdString) {
        console.error(`Unknown subcommand for ${command}`);
        process.exit(1);
    }

    console.log(`\x1b[36m> Executing: ${cmdString}\x1b[0m`);
    const result = spawnSync(cmdString, { stdio: 'inherit', shell: true });
    process.exit(result.status);
}

// Entry point
async function main() {
    if (command === 'verify' && (!subCommand || subCommand === 'all')) {
        await runVerify();
        return;
    }

    // Handle group mapping or direct subcommand
    if (SCRIPT_MAP[command]) {
        if (!subCommand) {
            console.log(`Available subcommands for ${command}:`, Object.keys(SCRIPT_MAP[command]).join(', '));
            process.exit(0);
        }
        run(SCRIPT_MAP[command][subCommand]);
    } else {
        // Check for flattened names like "metrics:code"
        const [group, action] = command.split(':');
        if (SCRIPT_MAP[group] && SCRIPT_MAP[group][action]) {
            run(SCRIPT_MAP[group][action]);
        } else {
            console.error(`Unknown command: ${command}`);
            process.exit(1);
        }
    }
}

main();
