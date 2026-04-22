#!/usr/bin/env node

const { spawnSync } = require('child_process');
const path = require('path');

const TEXT_EXTENSIONS = new Set([
    '.cjs',
    '.css',
    '.html',
    '.js',
    '.json',
    '.jsonc',
    '.jsx',
    '.md',
    '.mjs',
    '.ps1',
    '.rs',
    '.scss',
    '.sh',
    '.sql',
    '.toml',
    '.ts',
    '.tsx',
    '.txt',
    '.xml',
    '.yaml',
    '.yml',
]);

const INCLUDED_BASENAMES = new Set([
    '.env.example',
    '.gitignore',
    '.npmrc',
    'Dockerfile',
]);

const EXCLUDED_PATH_PREFIXES = [
    'dist/',
    'node_modules/',
    'public/monaco/',
    'release/',
    'resources/bin/',
];

const EXCLUDED_BASENAMES = new Set([
    'package-lock.json',
]);

function normalizePath(filePath) {
    return filePath.replace(/\\/g, '/');
}

function shouldScan(filePath) {
    const normalized = normalizePath(filePath);
    if (EXCLUDED_PATH_PREFIXES.some(prefix => normalized.startsWith(prefix))) {
        return false;
    }
    const basename = path.basename(normalized);
    if (EXCLUDED_BASENAMES.has(basename)) {
        return false;
    }
    if (INCLUDED_BASENAMES.has(basename)) {
        return true;
    }
    return TEXT_EXTENSIONS.has(path.extname(normalized).toLowerCase());
}

const gitResult = spawnSync('git', ['ls-files', '-z'], {
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
});

if (gitResult.status !== 0) {
    process.stderr.write(gitResult.stderr || 'Failed to list tracked files for secret scan.\n');
    process.exit(gitResult.status || 1);
}

const files = gitResult.stdout
    .split('\0')
    .filter(Boolean)
    .filter(shouldScan);

if (files.length === 0) {
    console.log('No tracked text files found for secret scan.');
    process.exit(0);
}

const secretlintBin = path.join(
    process.cwd(),
    'node_modules',
    'secretlint',
    'bin',
    'secretlint.js'
);
const chunkSize = 80;

console.log(`Secret scan: ${files.length} tracked text files.`);
for (let index = 0; index < files.length; index += chunkSize) {
    const chunk = files.slice(index, index + chunkSize);
    const result = spawnSync(process.execPath, [secretlintBin, '--secretlintignore', '.secretlintignore', ...chunk], {
        stdio: 'inherit',
    });
    if (result.status !== 0) {
        process.exit(result.status || 1);
    }
}
