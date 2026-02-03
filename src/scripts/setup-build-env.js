/**
 * Permanent build environment setup for native modules (node-pty, etc.)
 * This script runs automatically before npm install to configure the build environment
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { findVisualStudioByMSBuild, findVisualStudioVersions } = require('./detect-msvs-version');

function setupNpmRc(version) {
    const npmrcPath = path.join(__dirname, '..', '.npmrc');
    let npmrcContent = '';
    
    // Read existing .npmrc if it exists
    if (fs.existsSync(npmrcPath)) {
        npmrcContent = fs.readFileSync(npmrcPath, 'utf-8');
    }
    
    // Remove any existing msvs_version lines
    npmrcContent = npmrcContent
        .split('\n')
        .filter(line => !line.includes('msvs_version') && line.trim() !== '')
        .join('\n')
        .trim();
    
    // Add the msvs_version configuration
    // Note: npm doesn't actually read msvs_version from .npmrc, but we keep it for reference
    if (npmrcContent && !npmrcContent.endsWith('\n')) {
        npmrcContent += '\n';
    }
    npmrcContent += `# Auto-configured by setup-build-env.js\n`;
    npmrcContent += `# msvs_version=${version} (set as environment variable instead)\n`;
    
    // Write back to .npmrc
    fs.writeFileSync(npmrcPath, npmrcContent, 'utf-8');
    console.log(`✓ Created/updated .npmrc (reference only - env vars are used)`);
}

function setupEnvironmentVariables(version) {
    // Set for current process
    process.env.npm_config_msvs_version = version;
    process.env.GYP_MSVS_VERSION = version;
    process.env.msvs_version = version;
    
    // Also set in user environment (persistent)
    if (process.platform === 'win32') {
        try {
            execSync(`setx npm_config_msvs_version ${version}`, { stdio: 'ignore' });
            execSync(`setx GYP_MSVS_VERSION ${version}`, { stdio: 'ignore' });
        } catch (err) {
            // setx might fail, but that's okay
        }
    }
}

function main() {
    console.log('🔧 Setting up build environment for native modules...\n');

    // Detect VS version
    let version = null;
    let vsPath = null;
    
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

    if (!version) {
        console.warn('⚠️  No Visual Studio installation found!');
        console.warn('   Native modules may fail to build.');
        console.warn('   Install Visual Studio Build Tools with "Desktop development with C++" workload.');
        return;
    }

    // Setup .npmrc (permanent configuration)
    setupNpmRc(version);
    
    // Setup environment variables (for current session)
    setupEnvironmentVariables(version);
    
    console.log(`\n✅ Build environment configured for Visual Studio ${version}`);
    console.log('   Configuration saved to .npmrc (permanent)');
    console.log('   Environment variables set for current session');
}

if (require.main === module) {
    main();
}

module.exports = { main, setupNpmRc, setupEnvironmentVariables };
