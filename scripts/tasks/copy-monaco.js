/**
 * Tengra - Your Personal AI Assistant
 * Script to copy Monaco editor assets to public folder for local serving.
 */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../../');
const monacoSrc = path.join(root, 'node_modules/monaco-editor/min/vs');
const monacoDest = path.join(root, 'public/monaco/vs');

function copyDir(src, dest) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }

    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (let entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            // Only update if file size differs or doesn't exist to save time
            if (!fs.existsSync(destPath) || fs.statSync(srcPath).size !== fs.statSync(destPath).size) {
                fs.copyFileSync(srcPath, destPath);
            }
        }
    }
}

async function run() {
    console.log('--- Monaco Asset Preparation ---');
    try {
        if (!fs.existsSync(monacoSrc)) {
            console.error('Error: monaco-editor node_modules not found. Run npm install first.');
            process.exit(1);
        }

        console.log(`Source: ${monacoSrc}`);
        console.log(`Destination: ${monacoDest}`);

        copyDir(monacoSrc, monacoDest);
        
        console.log('SUCCESS: Monaco assets ready for local serving.');
    } catch (error) {
        console.error('FAILED to copy Monaco assets:', error);
        process.exit(1);
    }
}

run();
