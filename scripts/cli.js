/**
 * Tengra Project Tooling Dispatcher
 * Consolidates secondary scripts to keep package.json clean.
 */
const { spawnSync } = require('child_process');
const path = require('path');

const command = process.argv[2];
const subCommand = process.argv[3];
const args = process.argv.slice(4);

const SCRIPT_MAP = {
    perf: {
        startup: 'node scripts/perf-startup.js',
        budget: 'node scripts/audit-bundle-size.js',
        ci: 'npm run tool perf:startup && npm run tool perf:budget',
    },
    secrets: {
        scan: 'secretlint --secretlintignore .secretlintignore "**/*"',
    },
    docs: {
        ipc: 'node scripts/docs/generate-ipc-channels-doc.cjs',
        schemas: 'node scripts/ipc/generate-schema-docs.cjs',
    }
};

function run(cmdString) {
    if (!cmdString) {
        console.error(`Unknown subcommand for ${command}`);
        process.exit(1);
    }

    console.log(`\x1b[36m> Executing: ${cmdString}\x1b[0m`);
    const shell = process.platform === 'win32' ? 'powershell' : 'bash';
    const result = spawnSync(cmdString, { stdio: 'inherit', shell: true });
    process.exit(result.status);
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
