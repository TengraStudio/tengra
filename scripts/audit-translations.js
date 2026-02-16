const fs = require('fs');
const path = require('path');

const i18nDir = path.join(__dirname, '../src/renderer/i18n');
const locales = ['tr', 'de', 'fr', 'es', 'ja', 'zh', 'ar'];
const sourceFile = path.join(i18nDir, 'en.ts');

function extractKeys(obj, prefix = '') {
    let keys = [];
    for (const key in obj) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
            keys = keys.concat(extractKeys(obj[key], `${prefix}${key}.`));
        } else {
            keys.push(`${prefix}${key}`);
        }
    }
    return keys;
}

// Simple parser for TS files (since we can't easily run them as JS here without ts-node)
function parseTsObject(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    // Extract the export const ... = { ... } part
    const match = content.match(/export const \w+ = (\{[\s\S]+\});/);
    if (!match) return {};

    // Convert to JS object (crude way, but should work for plain translation objects)
    try {
        // Remove trailing commas which might break JSON.parse if we were using it
        // This is risky but let's try a safer regex for simple objects
        let jsonStr = match[1]
            .replace(/(\w+):/g, '"$1":') // Quote keys
            .replace(/'/g, '"') // Replace single quotes with double quotes
            .replace(/,\s*}/g, '}') // Remove trailing commas
            .replace(/,\s*\]/g, ']');

        return JSON.parse(jsonStr);
    } catch (e) {
        console.error(`Failed to parse ${filePath}: ${e.message}`);
        return {};
    }
}

console.log('--- Translation Audit Report ---');
const sourceData = parseTsObject(sourceFile);
const sourceKeys = extractKeys(sourceData);
console.log(`Source language (en) has ${sourceKeys.length} keys.\n`);

locales.forEach(locale => {
    const localeFile = path.join(i18nDir, `${locale}.ts`);
    if (!fs.existsSync(localeFile)) {
        console.log(`[${locale}] File missing!`);
        return;
    }

    const localeData = parseTsObject(localeFile);
    const localeKeys = new Set(extractKeys(localeData));

    const missing = sourceKeys.filter(key => !localeKeys.has(key));
    const coverage = ((sourceKeys.length - missing.length) / sourceKeys.length * 100).toFixed(1);

    console.log(`[${locale}] Coverage: ${coverage}% (${sourceKeys.length - missing.length}/${sourceKeys.length})`);
    if (missing.length > 0) {
        console.log(` Missing: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? ` (+${missing.length - 5} more)` : ''}`);
    }
});
