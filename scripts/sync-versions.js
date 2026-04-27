/**
 * Tengra - Version Synchronization Tool
 * Synchronizes versioning across package.json and Rust Cargo.toml files.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const PACKAGE_JSON_PATH = path.join(PROJECT_ROOT, 'package.json');
const RUST_WORKSPACE_PATH = path.join(PROJECT_ROOT, 'src/native/Cargo.toml');

function getGitHash() {
    try {
        return execSync('git rev-parse --short HEAD').toString().trim();
    } catch {
        return 'unknown';
    }
}

function isGitDirty() {
    try {
        return execSync('git status --porcelain').toString().trim().length > 0;
    } catch {
        return false;
    }
}

function sync() {
    console.log('Starting version synchronization...');

    // 1. Read package.json version
    const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf-8'));
    let version = pkg.version;

    // 2. Handle Auto-Increment
    if (process.argv.includes('--increment')) {
        const parts = version.split('.');
        if (parts.length === 3) {
            const patch = parseInt(parts[2], 10);
            if (!isNaN(patch)) {
                parts[2] = (patch + 1).toString();
                version = parts.join('.');
                pkg.version = version;
                fs.writeFileSync(PACKAGE_JSON_PATH, JSON.stringify(pkg, null, 4) + '\n', 'utf-8');
                console.log(`Auto-incremented package.json: ${version}`);
            }
        }
    }

    // 3. Compute dynamic dev version if requested
    if (process.argv.includes('--dev')) {
        const hash = getGitHash();
        const dirty = isGitDirty() ? '-dirty' : '';
        version = `${version}-dev.${hash}${dirty}`;
        console.log(`Computed development version: ${version}`);
    } else {
        console.log(`Using release version: ${version}`);
    }

    // 3. Update src/native/Cargo.toml (Workspace)
    if (fs.existsSync(RUST_WORKSPACE_PATH)) {
        let cargoContent = fs.readFileSync(RUST_WORKSPACE_PATH, 'utf-8');
        
        // Use regex to replace version in [workspace.package]
        const versionRegex = /(?<=^\[workspace\.package\][\s\S]*?^version\s*=\s*")[^"]*/m;
        
        if (versionRegex.test(cargoContent)) {
            const oldVersion = cargoContent.match(versionRegex)[0];
            if (oldVersion !== version) {
                cargoContent = cargoContent.replace(versionRegex, version);
                fs.writeFileSync(RUST_WORKSPACE_PATH, cargoContent, 'utf-8');
                console.log(`Updated Rust workspace version: ${oldVersion} -> ${version}`);
            } else {
                console.log('Rust workspace version is already in sync.');
            }
        } else {
            console.error('Could not find version field in [workspace.package] section of Cargo.toml');
        }
    }

    // 4. (Optional) Inject version into other files if needed
    console.log('Version synchronization complete.');
}

if (require.main === module) {
    sync();
}
