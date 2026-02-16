const fs = require('fs');
const path = require('path');

// Path to compiled JS files
const compiledDir = path.join(__dirname, 'temp-i18n');
// const locales = ['tr', 'de', 'fr', 'es', 'ja', 'zh', 'ar'];
// Read locales from the directory itself to be sure
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

try {
    if (!fs.existsSync(compiledDir)) {
        console.error('Error: Compiled translations not found. Run "npx tsc src/renderer/i18n/*.ts --outDir scripts/temp-i18n ..." first.');
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
    const sourceKeys = extractKeys(sourceData);
    console.log(`Source language (en) has ${sourceKeys.length} keys.\n`);

    locales.forEach(locale => {
        const localeFile = path.join(compiledDir, `${locale}.js`);

        try {
            const localeModule = require(localeFile);
            // Export name is usually the locale code, but let's check keys
            // The compiled JS usually looks like exports.ar = { ... }
            const localeData = localeModule[locale] || localeModule.default;

            if (!localeData) {
                console.log(`[${locale}] Failed to find export '${locale}' in module.`);
                return;
            }

            const localeKeys = new Set(extractKeys(localeData));

            const missing = sourceKeys.filter(key => !localeKeys.has(key));
            const coverage = ((sourceKeys.length - missing.length) / sourceKeys.length * 100).toFixed(1);

            console.log(`[${locale}] Coverage: ${coverage}% (${sourceKeys.length - missing.length}/${sourceKeys.length})`);
            if (missing.length > 0) {
                console.log(` Missing (${missing.length}): ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? ` (+${missing.length - 5} more)` : ''}`);
            }
        } catch (err) {
            console.error(`[${locale}] Failed to load: ${err.message}`);
        }
    });

} catch (e) {
    console.error(`Fatal error: ${e.message}`);
}
