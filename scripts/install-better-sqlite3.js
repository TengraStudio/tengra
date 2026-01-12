/**
 * Install better-sqlite3 with proper MSVS version set
 * This script ensures the environment variable is set in the current process
 * before running npm install
 */

const { execSync } = require('child_process');
const { setupEnvironmentVariables } = require('./setup-build-env');
const { findVisualStudioByMSBuild, findVisualStudioVersions } = require('./detect-msvs-version');

function main() {
    console.log('📦 Installing better-sqlite3 with proper build configuration...\n');

    // Ensure build environment is set up
    require('./setup-build-env').main();

    // Detect VS version for environment setup
    let version = null;
    const vsFromVswhere = findVisualStudioByMSBuild();
    if (vsFromVswhere) {
        version = vsFromVswhere.version;
    } else {
        const versions = findVisualStudioVersions();
        if (versions.length > 0) {
            version = versions[0].version;
        }
    }

    if (!version) {
        console.error('❌ No Visual Studio installation found!');
        console.error('\nPlease install Visual Studio Build Tools with "Desktop development with C++" workload.');
        process.exit(1);
    }

    // Set environment variables for this process
    setupEnvironmentVariables(version);

    // Create clean environment without conflicting VS vars
    const env = {
        ...process.env,
        npm_config_msvs_version: version,
        GYP_MSVS_VERSION: version,
        msvs_version: version
    };

    // Clear conflicting VS environment variables
    const vsVarsToClear = [
        'VSINSTALLDIR', 'VCINSTALLDIR', 'VCToolsInstallDir', 
        'VSCMD_ARG_app_plat', 'VSCMD_ARG_HOST_ARCH', 'VSCMD_ARG_TGT_ARCH',
        'VSCMD_VER'
    ];
    
    vsVarsToClear.forEach(varName => {
        if (env[varName]) {
            delete env[varName];
        }
    });

    console.log(`\n📦 Installing better-sqlite3...\n`);
    
    try {
        execSync('npm install better-sqlite3@^11.10.0 --legacy-peer-deps', {
            stdio: 'inherit',
            env: env,
            shell: true
        });
        console.log('\n✅ Successfully installed better-sqlite3!');
    } catch (error) {
        console.error('\n❌ Failed to install better-sqlite3');
        console.error('Error:', error.message);
        console.error('\n💡 Tip: Make sure Visual Studio 2022 Build Tools is installed with "Desktop development with C++" workload.');
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { main };
