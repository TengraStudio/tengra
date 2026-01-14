#!/usr/bin/env node
/**
 * Module Boundary Checker
 * Verifies that module boundaries are respected between main, renderer, and shared code.
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT_DIR, 'src');

console.log('🔍 Checking Module Boundaries\n');
console.log('='.repeat(50));

const violations = [];

// Patterns that should not appear in certain directories
const rules = {
    'src/renderer': {
        forbidden: [
            { pattern: /from ['"]electron['"]/, message: 'Direct electron import in renderer' },
            { pattern: /from ['"]fs['"]/, message: 'Node fs module in renderer' },
            { pattern: /from ['"]path['"]/, message: 'Node path module in renderer' },
            { pattern: /from ['"]child_process['"]/, message: 'Node child_process in renderer' },
            { pattern: /from ['"]\.\.\/\.\.\/main\//, message: 'Direct main process import' },
            { pattern: /from ['"]@main\//, message: 'Main process alias import' }
        ]
    },
    'src/main': {
        forbidden: [
            { pattern: /from ['"]react['"]/, message: 'React import in main process' },
            { pattern: /from ['"]\.\.\/\.\.\/renderer\//, message: 'Direct renderer import' },
            { pattern: /from ['"]@\//, message: 'Renderer alias import in main' }
        ]
    },
    'src/shared': {
        forbidden: [
            { pattern: /from ['"]electron['"]/, message: 'Electron in shared code' },
            { pattern: /from ['"]react['"]/, message: 'React in shared code' },
            { pattern: /from ['"]fs['"]/, message: 'Node fs in shared code' },
            { pattern: /from ['"]\.\.\/main\//, message: 'Main import in shared' },
            { pattern: /from ['"]\.\.\/renderer\//, message: 'Renderer import in shared' }
        ]
    }
};

function getAllFiles(dir, files = []) {
    const items = fs.readdirSync(dir);

    for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory() && !item.includes('node_modules')) {
            getAllFiles(fullPath, files);
        } else if (item.endsWith('.ts') || item.endsWith('.tsx')) {
            files.push(fullPath);
        }
    }

    return files;
}

function checkFile(filePath, forbidden) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const relativePath = path.relative(ROOT_DIR, filePath);
    const fileViolations = [];

    for (const rule of forbidden) {
        if (rule.pattern.test(content)) {
            fileViolations.push({
                file: relativePath,
                message: rule.message
            });
        }
    }

    return fileViolations;
}

// Check each directory
for (const [dir, config] of Object.entries(rules)) {
    const fullDir = path.join(ROOT_DIR, dir);

    if (!fs.existsSync(fullDir)) {
        console.log(`⚠️  Directory not found: ${dir}`);
        continue;
    }

    console.log(`\n📁 Checking ${dir}...`);

    const files = getAllFiles(fullDir);
    let dirViolations = 0;

    for (const file of files) {
        const fileViolations = checkFile(file, config.forbidden);
        violations.push(...fileViolations);
        dirViolations += fileViolations.length;
    }

    if (dirViolations === 0) {
        console.log(`   ✅ No violations found (${files.length} files checked)`);
    } else {
        console.log(`   ❌ ${dirViolations} violation(s) found`);
    }
}

// Print violations
if (violations.length > 0) {
    console.log('\n' + '='.repeat(50));
    console.log('❌ BOUNDARY VIOLATIONS DETECTED\n');

    // Group by file
    const byFile = {};
    for (const v of violations) {
        if (!byFile[v.file]) byFile[v.file] = [];
        byFile[v.file].push(v.message);
    }

    for (const [file, messages] of Object.entries(byFile)) {
        console.log(`📄 ${file}`);
        for (const msg of messages) {
            console.log(`   ⚠️  ${msg}`);
        }
    }

    console.log('\n' + '='.repeat(50));
    console.log(`Total: ${violations.length} violation(s)`);
    console.log('\nFix these issues to maintain proper module boundaries.');
    process.exit(1);
} else {
    console.log('\n' + '='.repeat(50));
    console.log('✅ All module boundaries are respected!');
    console.log('='.repeat(50));
}
