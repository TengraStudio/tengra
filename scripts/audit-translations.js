const fs = require('fs');
const path = require('path');

const { execSync } = require('child_process');

// Path to compiled JS files
const compiledDir = path.join(__dirname, 'temp-i18n');
console.log('Compiling translations...');
try {
    if (fs.existsSync(compiledDir)) {
        fs.rmSync(compiledDir, { recursive: true, force: true });
    }
    // Explicitly list files to avoid glob issues on Windows
    const languages = ['ar', 'de', 'en', 'es', 'fr', 'ja', 'tr', 'zh'];
    const files = languages.map(lang => `src/renderer/i18n/${lang}.ts`).join(' ');

    // We only need the translation files
    execSync(`npx tsc ${files} --outDir scripts/temp-i18n --module commonjs --target es5 --skipLibCheck`);
} catch (e) {
    console.error('Compilation failed:', e.message);
    process.exit(1);
}

// Re-read locales after compilation
const files = fs.readdirSync(compiledDir).filter(f => f.endsWith('.js') && f !== 'en.js' && f !== 'index.js');
const locales = files.map(f => f.replace('.js', ''));

// Recursive function to flatten keys
function extractKeys(obj, prefix = '') {
    let keys = [];
    for (const key in obj) {
        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
            keys = keys.concat(extractKeys(obj[key], `${prefix}${key}.`));
        } else {
            keys.push(`${prefix}${key}`);
        }
    }
    return keys;
}

// Function to scan codebase for t('key') usage
function scanCodebase(dir) {
    let keys = new Set();
    const items = fs.readdirSync(dir);
    for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            if (item !== 'node_modules' && item !== '.git' && item !== 'dist' && item !== 'build') {
                const subKeys = scanCodebase(fullPath);
                subKeys.forEach(k => keys.add(k));
            }
        } else if (item.endsWith('.tsx') || item.endsWith('.ts')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            // Match t('key') or t("key")
            const matches = content.matchAll(/\bt\(['"]([\w.]+)['"]\)/g);
            for (const match of matches) {
                keys.add(match[1]);
            }
        }
    }
    return keys;
}

try {
    if (!fs.existsSync(compiledDir)) {
        console.error('Error: Compiled translations not found.');
        process.exit(1);
    }

    console.log('--- Translation Audit Report ---');

    // Load source (en)
    const sourcePath = path.join(compiledDir, 'en.js');
    if (!fs.existsSync(sourcePath)) {
        console.error('Error: en.js not found in temp-i18n.');
        process.exit(1);
    }

    const sourceModule = require(sourcePath);
    const sourceData = sourceModule.en;
    const sourceKeys = new Set(extractKeys(sourceData));
    console.log(`Source language (en) has ${sourceKeys.size} keys.\n`);

    // Scan Codebase
    console.log('Scanning codebase for usage...');
    const srcDir = path.join(__dirname, '../src/renderer');
    const usedKeys = scanCodebase(srcDir);
    console.log(`Found ${usedKeys.size} unique keys used in codebase.`);

    const missingInEn = [...usedKeys].filter(key => !sourceKeys.has(key));
    if (missingInEn.length > 0) {
        console.log(`\n[CRITICAL] Keys used in code but missing in en.ts (${missingInEn.length}):`);
        missingInEn.forEach(k => console.log(` - ${k}`));

        // Save to file
        const missingFile = path.join(__dirname, '../docs/missing-translations.json');
        fs.writeFileSync(missingFile, JSON.stringify(missingInEn, null, 2));
        console.log(`\nSaved missing keys list to ${missingFile}`);
    } else {
        console.log('\n[OK] All keys used in code are present in en.ts.');
    }

    console.log('\n--- Locale Coverage ---');
    locales.forEach(locale => {
        const localeFile = path.join(compiledDir, `${locale}.js`);

        try {
            const localeModule = require(localeFile);
            const localeData = localeModule[locale] || localeModule.default;

            if (!localeData) {
                console.log(`[${locale}] Failed to find export '${locale}' in module.`);
                return;
            }

            const localeKeys = new Set(extractKeys(localeData));
            const sourceKeysArr = [...sourceKeys];
            const missing = sourceKeysArr.filter(key => !localeKeys.has(key));
            const coverage = ((sourceKeys.size - missing.length) / sourceKeys.size * 100).toFixed(1);

            console.log(`[${locale}] Coverage: ${coverage}% (${sourceKeys.size - missing.length}/${sourceKeys.size})`);
            if (missing.length > 0) {
                // console.log(` Missing (${missing.length}): ${missing.slice(0, 5).join(', ')}...`);
            }
        } catch (err) {
            console.error(`[${locale}] Failed to load: ${err.message}`);
        }
    });

} catch (e) {
    console.error(`Fatal error: ${e.message}`);
}
