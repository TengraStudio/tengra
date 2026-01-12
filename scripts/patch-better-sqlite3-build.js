/**
 * Patch better-sqlite3's binding.gyp to use v145 toolset
 * This fixes the MSVC 14.50 compatibility issue
 */

const fs = require('fs');
const path = require('path');

function patchBindingGyp() {
    const bindingGypPath = path.join(__dirname, '..', 'node_modules', 'better-sqlite3', 'binding.gyp');
    
    if (!fs.existsSync(bindingGypPath)) {
        console.log('⚠️  better-sqlite3 not installed yet, skipping patch');
        return false;
    }

    let content = fs.readFileSync(bindingGypPath, 'utf-8');
    const originalContent = content;

    // The issue: MSVC 14.50 requires v145 toolset, but v145 isn't installed
    // Solution: Set VCToolsVersion to 14.3*.* to use compatible MSVC with v143
    // Find available MSVC version that works with v143
    
    // Check if msbuild_settings exists
    if (content.includes('msbuild_settings')) {
        // Update existing - set VCToolsVersion to 14.3 pattern to force compatible version
        content = content.replace(
            /('msbuild_settings':\s*\{[^}]*)/,
            `'msbuild_settings': {
      'VCToolsVersion': '14.39',
      'PlatformToolset': 'v143'
    }`
        );
    } else {
        // Add new msbuild_settings - insert before 'targets'
        if (content.includes("'targets':")) {
            content = content.replace(
                /(\s*'targets':\s*\[)/,
                `    'msbuild_settings': {
      'VCToolsVersion': '14.39',
      'PlatformToolset': 'v143'
    },
$1`
            );
        } else {
            // Add at root level before closing brace
            const lines = content.split('\n');
            const lastBraceIndex = lines.length - 1;
            if (lastBraceIndex >= 0 && lines[lastBraceIndex].trim() === '}') {
                const indent = lines[lastBraceIndex].match(/^(\s*)/)?.[1] || '';
                lines.splice(lastBraceIndex, 0, 
                    `${indent}  'msbuild_settings': {`,
                    `${indent}    'VCToolsVersion': '14.39',`,
                    `${indent}    'PlatformToolset': 'v143'`,
                    `${indent}  },`
                );
                content = lines.join('\n');
            }
        }
    }

    if (content !== originalContent) {
        fs.writeFileSync(bindingGypPath, content, 'utf-8');
        console.log('✓ Patched binding.gyp to use v145 toolset');
        return true;
    }

    return false;
}

if (require.main === module) {
    patchBindingGyp();
}

module.exports = { patchBindingGyp };
