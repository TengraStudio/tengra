#!/usr/bin/env node
/**
 * Setup build environment
 * Prepares the build environment for development and CI/CD
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');

console.log('Setting up build environment...');

// Ensure dist directory exists
const distDir = path.join(ROOT_DIR, 'dist');
if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
    console.log('✓ Created dist directory');
}

// Ensure resources/bin directory exists
const binDir = path.join(ROOT_DIR, 'resources', 'bin');
if (!fs.existsSync(binDir)) {
    fs.mkdirSync(binDir, { recursive: true });
    console.log('✓ Created resources/bin directory');
}

// Check for required environment
const nodeVersion = process.version;
console.log(`✓ Node.js version: ${nodeVersion}`);

// Check platform
const platform = process.platform;
console.log(`✓ Platform: ${platform}`);

console.log('✓ Build environment setup complete');
process.exit(0);
