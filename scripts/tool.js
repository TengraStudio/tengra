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

    metrics: {
        all: 'npm run tool metrics:code && npm run tool metrics:coverage && npm run tool metrics:debt && npm run tool audit:report',
        code: 'node scripts/code-metrics-report.cjs',
        debt: 'node scripts/technical-debt-report.cjs',
        coverage: 'node scripts/coverage-report.cjs',
        lint: 'node scripts/lint-typecheck-dashboard.cjs',
        names: 'node scripts/naming-conventions-report.cjs',
    },
    perf: {
        dashboard: 'node scripts/performance-dashboard.cjs',
        startup: 'node scripts/benchmark-startup.js',
        memory: 'node scripts/benchmark-memory.js',
        ipc: 'node scripts/benchmark-ipc-latency.cjs',
        db: 'node scripts/benchmark-db-performance.cjs',
        budget: 'tsx scripts/check-bundle-size.ts',
        ci: 'npm run tool perf:startup && npm run tool bundle:analyze',
    },
    secrets: {
        scan: 'secretlint --secretlintignore .secretlintignore "**/*"',
        detect: 'detect-secrets scan --baseline .secrets.baseline',
        audit: 'detect-secrets audit .secrets.baseline',
        update: 'detect-secrets scan --baseline .secrets.baseline --update .secrets.baseline',
    },
    mcp: {
        new: 'node scripts/mcp/generate-server.cjs',
        docs: 'node scripts/docs/generate-mcp-docs.cjs',
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
