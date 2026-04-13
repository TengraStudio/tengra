#!/usr/bin/env node
/**
 * Setup build environment
 * Prepares the build environment for development and CI/CD
 * Permanent build environment setup for native modules (node-pty, etc.)
 * This script runs automatically before npm install to configure the build environment
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { findVisualStudioByMSBuild, findVisualStudioVersions, setMSVSVersion } = require('./tasks/win-vs-detect');

// Root directory of the project
const ROOT_DIR = path.join(__dirname, '..');

/**
 * Update .npmrc with a single Visual Studio reference block.
 * @param {string} version Visual Studio version
 */
function setupNpmRc(version) {
    const npmrcPath = path.join(ROOT_DIR, '.npmrc');
    let npmrcContent = '';

    // Read existing .npmrc if it exists
    try {
        if (fs.existsSync(npmrcPath)) {
            npmrcContent = fs.readFileSync(npmrcPath, 'utf-8');
        }
    } catch (err) {
        console.error('Failed to read .npmrc:', err.message);
    }

    // Remove any previously generated reference lines before writing the current one.
    npmrcContent = npmrcContent
        .split('\n')
        .filter(line =>
            !line.includes('msvs_version') &&
            !line.includes('# Auto-configured by setup-build-env.js') &&
            !line.includes('# Auto-configured by build-env-setup.js') &&
            line.trim() !== ''
        )
        .join('\n')
        .trim();

    // Keep a single note in .npmrc for local troubleshooting reference.
    if (npmrcContent && !npmrcContent.endsWith('\n')) {
        npmrcContent += '\n';
    }
    npmrcContent += `\n# Auto-configured by build-env-setup.js\n`;
    npmrcContent += `# msvs_version=${version} (set as environment variable instead)\n`;

    // Write back to .npmrc
    try {
        fs.writeFileSync(npmrcPath, npmrcContent, 'utf-8');
        console.log('✓ Created/updated .npmrc (reference only - env vars are used)');
    } catch (err) {
        console.error('Failed to write .npmrc:', err.message);
    }
}

/**
 * Patch node-pty and its dependencies to disable Spectre mitigation
 * This is necessary because node-pty hardcodes 'SpectreMitigation': 'Spectre'
 * in multiple .gyp files, which requires special libraries.
 */
function patchNodePty() {
    const nodePtyDir = path.join(ROOT_DIR, 'node_modules', 'node-pty');
    if (!fs.existsSync(nodePtyDir)) return;

    // Find all .gyp files in node-pty directory recursively
    const findGypFiles = (dir, fileList = []) => {
        const files = fs.readdirSync(dir);
        files.forEach(file => {
            const filePath = path.join(dir, file);
            if (fs.statSync(filePath).isDirectory()) {
                if (file !== 'node_modules') { // Skip nested node_modules
                    findGypFiles(filePath, fileList);
                }
            } else if (file.endsWith('.gyp')) {
                fileList.push(filePath);
            }
        });
        return fileList;
    };

    try {
        const gypFiles = findGypFiles(nodePtyDir);
        gypFiles.forEach(gypPath => {
            let content = fs.readFileSync(gypPath, 'utf-8');
            if (content.includes("'SpectreMitigation': 'Spectre'")) {
                console.log(`🔧 Patching ${path.relative(ROOT_DIR, gypPath)} to disable Spectre mitigation...`);
                content = content.replace(/'SpectreMitigation': 'Spectre'/g, "'SpectreMitigation': 'false'");
                fs.writeFileSync(gypPath, content, 'utf-8');
                console.log(`✓ ${path.basename(gypPath)} patched successfully`);
            }
        });
    } catch (err) {
        console.error('Failed to patch node-pty .gyp files:', err.message);
    }
}

/**
 * Setup environment variables
 * @param {string} version Visual Studio version
 */function setupEnvironmentVariables(version) {
    // npm 10 warns on npm_config_msvs_version, so prefer the node-gyp variables directly.
    delete process.env.npm_config_msvs_version;
    process.env.GYP_MSVS_VERSION = version;
    process.env.msvs_version = version;
    process.env.SpectreMitigation = 'false';

    // Also set in user environment (persistent)
    if (process.platform === 'win32') {
        try {
            execSync(`setx GYP_MSVS_VERSION ${version}`, { stdio: 'ignore' });
            execSync(`setx SpectreMitigation false`, { stdio: 'ignore' });
        } catch (err) {
            // setx might fail, but that's okay
        }
    }
}

/**
 * Main setup function merging both scripts
 */
function main() {
    console.log('🔧 Setting up build environment...\n');

    // From scripts/setup-build-env.js: Ensure critical directories exist
    const dirs = [
        path.join(ROOT_DIR, 'dist')
    ];

    dirs.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`✓ Created directory: ${path.relative(ROOT_DIR, dir)}`);
        }
    });

    console.log(`✓ Node.js version: ${process.version}`);
    console.log(`✓ Platform: ${process.platform}`);

    // Detect VS version (from src/scripts/setup-build-env.js)
    let version = null;
    let vsPath = null;

    if (process.platform === 'win32') {
        const vsFromVswhere = findVisualStudioByMSBuild();
        if (vsFromVswhere) {
            version = vsFromVswhere.version;
            vsPath = vsFromVswhere.path;
            console.log(`Found Visual Studio ${version} at: ${vsPath}`);
        } else {
            const versions = findVisualStudioVersions();
            if (versions.length > 0) {
                version = versions[0].version;
                vsPath = versions[0].path;
                console.log(`Found Visual Studio ${version} at: ${vsPath}`);
            }
        }
    }

    if (process.platform === 'win32' && !version) {
        console.warn('⚠️  No Visual Studio installation found!');
        console.warn('   Native modules may fail to build.');
        console.warn('   Install Visual Studio Build Tools with "Desktop development with C++" workload.');
    } else if (version) {
        // Setup .npmrc and environment
        setupNpmRc(version);

        if (typeof setMSVSVersion === 'function') {
            setMSVSVersion(version);
        } else {
            setupEnvironmentVariables(version);
        }

        console.log(`\n✅ Build environment configured for Visual Studio ${version}`);
    }

    // Patch known problematic dependencies
    patchNodePty();

    console.log('✓ Build environment setup complete');
}

if (require.main === module) {
    main();
}

module.exports = { main, setupNpmRc, setupEnvironmentVariables };
