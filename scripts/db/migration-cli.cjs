#!/usr/bin/env node
 
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const command = args[0] || 'help';
const dryRun = args.includes('--dry-run');
const outDir = path.join(process.cwd(), 'reports', 'engineering');
const outFile = path.join(outDir, 'db-migration-cli-report.json');

function writeReport(payload) {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(outFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function main() {
    const payload = {
        command,
        dryRun,
        timestamp: new Date().toISOString(),
        note: 'This CLI creates migration/rollback plans. Execute via app IPC handlers: db:runMigrations / db:rollbackLastMigration.'
    };

    if (command === 'rollback') {
        payload.action = 'rollback-last-migration';
        payload.instructions = [
            'Use IPC channel db:rollbackLastMigration',
            'Pass { dryRun: true } first',
            'If successful, run without dryRun'
        ];
    } else if (command === 'migrate') {
        payload.action = 'run-migrations';
        payload.instructions = [
            'Use IPC channel db:runMigrations',
            'Pass { dryRun: true } first',
            'If successful, run without dryRun'
        ];
    } else {
        payload.action = 'help';
        payload.instructions = [
            'Usage: npm run db:migrate:plan',
            'Usage: npm run db:migrate:rollback',
            'Append -- --dry-run for simulation'
        ];
    }

    writeReport(payload);
    console.log(`Wrote ${outFile}`);
}

main();
