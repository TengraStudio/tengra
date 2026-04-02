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
