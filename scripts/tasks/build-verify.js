/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const { spawn } = require('child_process');

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

async function verify() {
    const startTime = Date.now();
    console.log('Starting parallel verification (Lint, TypeCheck, Test)...');

    try {
        await Promise.all([
            runCommand('npm', ['run', 'lint'], 'Lint'),
            runCommand('npm', ['run', 'type-check'], 'TypeCheck'),
            runCommand('npm', ['run', 'test'], 'Test')
        ]);

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`\n✅ Verification completed successfully in ${duration}s!`);
    } catch (error) {
        console.error('\n❌ Verification failed!');
        process.exit(1);
    }
}

verify();
