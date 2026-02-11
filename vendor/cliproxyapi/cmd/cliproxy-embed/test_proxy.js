const { spawn } = require('child_process');
const path = require('path');

const binary = path.join(__dirname, 'cliproxy-embed.exe');
const child = spawn(binary, ['-health=true'], {
    cwd: __dirname,
    stdio: 'pipe'
});

child.stdout.on('data', (d) => console.log('STDOUT:', d.toString()));
child.stderr.on('data', (d) => console.log('STDERR:', d.toString()));

child.on('close', (code) => {
    console.log('EXIT CODE:', code);
    process.exit(code);
});

setTimeout(() => {
    console.log('Timeout reached, killing...');
    child.kill();
}, 5000);
