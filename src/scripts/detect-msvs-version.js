/**
 * Auto-detect and set the correct Visual Studio version for node-gyp
 * This script finds the latest installed Visual Studio and sets npm config
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function findVisualStudioVersions() {
    const versions = [];
    const possiblePaths = [
        'C:\\Program Files\\Microsoft Visual Studio',
        'C:\\Program Files (x86)\\Microsoft Visual Studio'
    ];

    for (const basePath of possiblePaths) {
        if (!fs.existsSync(basePath)) continue;

        try {
            const entries = fs.readdirSync(basePath);
            for (const entry of entries) {
                const fullPath = path.join(basePath, entry);
                const stat = fs.statSync(fullPath);
                
                if (stat.isDirectory()) {
                    // Check for version folders (e.g., "2022", "2019", etc.)
                    const versionMatch = entry.match(/^(\d{4})$|^(\d{2})$|^(\d+\.\d+)$/);
                    if (versionMatch) {
                        // Check if it has BuildTools or Community/Professional/Enterprise
                        const subDirs = fs.readdirSync(fullPath);
                        const hasBuildTools = subDirs.some(dir => 
                            ['BuildTools', 'Community', 'Professional', 'Enterprise'].includes(dir)
                        );
                        
                        if (hasBuildTools) {
                            const version = versionMatch[1] || versionMatch[2] || versionMatch[3];
                            versions.push({
                                version: version,
                                path: fullPath,
                                year: parseInt(version) || (version.includes('.') ? parseFloat(version) : 0)
                            });
                        }
                    }
                }
            }
        } catch (err) {
            // Ignore permission errors
        }
    }

    return versions.sort((a, b) => b.year - a.year); // Sort by year, newest first
}

function findVisualStudioByMSBuild() {
    try {
        // Try to find via vswhere (Visual Studio Installer tool)
        const vswherePath = path.join(
            process.env['ProgramFiles(x86)'] || process.env.ProgramFiles || '',
            'Microsoft Visual Studio', 'Installer', 'vswhere.exe'
        );

        if (fs.existsSync(vswherePath)) {
            const output = execSync(
                `"${vswherePath}" -latest -property installationPath -format value`,
                { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }
            ).trim();

            if (output) {
                // Extract version from path (e.g., "2022", "2019")
                const versionMatch = output.match(/\\\\(\d{4})\\\\/);
                if (versionMatch) {
                    return {
                        version: versionMatch[1],
                        path: output,
                        method: 'vswhere'
                    };
                }
            }
        }
    } catch (err) {
        // vswhere not found or failed
    }

    // Fallback: check common installation paths
    const commonPaths = [
        { version: '2022', path: 'C:\\Program Files\\Microsoft Visual Studio\\2022' },
        { version: '2019', path: 'C:\\Program Files (x86)\\Microsoft Visual Studio\\2019' },
        { version: '2022', path: 'C:\\Program Files (x86)\\Microsoft Visual Studio\\2022' }
    ];

    for (const { version, path: vsPath } of commonPaths) {
        // Check for BuildTools or Community
        if (fs.existsSync(path.join(vsPath, 'BuildTools')) || 
            fs.existsSync(path.join(vsPath, 'Community')) ||
            fs.existsSync(path.join(vsPath, 'Professional')) ||
            fs.existsSync(path.join(vsPath, 'Enterprise'))) {
            return { version, path: vsPath, method: 'common-path' };
        }
    }

    return null;
}

function setMSVSVersion(version) {
    try {
        // Set environment variable (this is what node-gyp actually uses)
        // For Windows, we need to set it in the user's environment
        const isWindows = process.platform === 'win32';
        
        if (isWindows) {
            // Set for current process (CRITICAL - this is what matters for npm install)
            process.env.npm_config_msvs_version = version;
            process.env.GYP_MSVS_VERSION = version;
            process.env.msvs_version = version;
            
            // Also try to set it in user environment (persistent for future sessions)
            try {
                execSync(`setx npm_config_msvs_version ${version}`, { stdio: 'ignore' });
            } catch (err) {
                // setx might fail, but that's okay - we set it for current session
            }
            
            try {
                execSync(`setx GYP_MSVS_VERSION ${version}`, { stdio: 'ignore' });
            } catch (err) {
                // setx might fail, but that's okay
            }
        } else {
            // Unix-like systems
            process.env.npm_config_msvs_version = version;
            process.env.GYP_MSVS_VERSION = version;
            process.env.msvs_version = version;
        }
        
        console.log(`✓ Set environment variable npm_config_msvs_version to ${version}`);
        console.log(`✓ Set environment variable GYP_MSVS_VERSION to ${version}`);
        console.log(`✓ Set environment variable msvs_version to ${version}`);
        console.log(`\n⚠️  Note: You may need to restart your terminal for the changes to take full effect.`);
        console.log(`   Or run: $env:npm_config_msvs_version="${version}" (PowerShell)`);
        console.log(`   Or run: set npm_config_msvs_version=${version} (CMD)`);
        
        return true;
    } catch (err) {
        console.error(`✗ Failed to set msvs_version:`, err.message);
        return false;
    }
}

function main() {
    console.log('🔍 Detecting Visual Studio installation...\n');

    // Method 1: Use vswhere (most reliable)
    const vsFromVswhere = findVisualStudioByMSBuild();
    if (vsFromVswhere) {
        console.log(`Found Visual Studio ${vsFromVswhere.version} at: ${vsFromVswhere.path}`);
        console.log(`Method: ${vsFromVswhere.method}\n`);
        
        if (setMSVSVersion(vsFromVswhere.version)) {
            console.log(`\n✅ Successfully configured for Visual Studio ${vsFromVswhere.version}`);
            return;
        }
    }

    // Method 2: Scan directories
    console.log('Scanning installation directories...\n');
    const versions = findVisualStudioVersions();
    
    if (versions.length === 0) {
        console.error('❌ No Visual Studio installation found!');
        console.error('\nPlease install Visual Studio Build Tools with "Desktop development with C++" workload.');
        console.error('Download from: https://visualstudio.microsoft.com/downloads/');
        process.exit(1);
    }

    console.log(`Found ${versions.length} Visual Studio installation(s):`);
    versions.forEach((vs, i) => {
        console.log(`  ${i + 1}. Visual Studio ${vs.version} at ${vs.path}`);
    });

    // Use the newest version
    const latest = versions[0];
    console.log(`\nUsing latest version: Visual Studio ${latest.version}\n`);

    if (setMSVSVersion(latest.version)) {
        console.log(`\n✅ Successfully configured for Visual Studio ${latest.version}`);
    } else {
        console.error('\n❌ Failed to set msvs_version');
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { findVisualStudioByMSBuild, findVisualStudioVersions, setMSVSVersion };
