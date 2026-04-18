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

function runDevServer() {
    const env = { ...process.env, NODE_OPTIONS: '--max-old-space-size=8192' };
    delete env.ELECTRON_RUN_AS_NODE;

    const command = 'npx';
    const child = spawn(command, ['vite'], {
        stdio: 'inherit',
        shell: true,
        env
    });

    child.on('close', code => {
        process.exit(code ?? 0);
    });

    child.on('error', error => {
        process.stderr.write(`Failed to start Vite dev server: ${error.message}\n`);
        process.exit(1);
    });
}

runDevServer();
