'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const MAIN_ENTRY = path.join(PROJECT_ROOT, 'dist', 'main', 'main.js');

function writeStdout(message) {
  process.stdout.write(`${message}\n`);
}

function writeStderr(message) {
  process.stderr.write(`${message}\n`);
}

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

    proc.on('error', error => {
      writeStderr(`[${name}] Failed to start: ${error.message}`);
      reject(error);
    });

    proc.on('close', code => {
      if (code === 0) {
        writeStdout(`[${name}] Completed successfully.`);
        resolve();
        return;
      }

      writeStderr(`[${name}] Failed with exit code ${code}.`);
      reject(new Error(`[${name}] failed`));
    });
  });
}

async function main() {
  const startTime = Date.now();

  try {
    if (!fs.existsSync(MAIN_ENTRY)) {
      writeStdout('[PerfContract] dist/main/main.js not found. Building before running the contract.');
      await runCommand('npm', ['run', 'build'], 'Build');
    }

    await runCommand('npx', ['playwright', 'test', 'src/tests/e2e/performance.spec.ts'], 'PerfContract');

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    writeStdout(`Performance contract completed successfully in ${duration}s.`);
  } catch (error) {
    writeStderr(`Performance contract failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    process.exit(1);
  }
}

main();
