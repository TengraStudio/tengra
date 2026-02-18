
import * as fs from 'fs';
import * as path from 'path';

// Helper to flatten object keys
function flattenKeys(obj: any, prefix = ''): string[] {
    let keys: string[] = [];
    for (const key in obj) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
            keys = keys.concat(flattenKeys(obj[key], prefix + key + '.'));
        } else {
            keys.push(prefix + key);
        }
    }
    return keys;
}

async function audit() {
    const i18nDir = path.join(__dirname, '../src/renderer/i18n');

    // Dynamic import is needed because these are ES modules potentially
    // But since we are in a script, we might have issues with path aliases if we used them in imports.
    // Fortunately, the file contents showed no imports in en.ts/zh.ts.
    // However, I need to handle the fact that I'm running this with ts-node.

    // Let's try to require them. 
    // If that fails, I'll have to parse them or rely on ts-node handling.

    const en = require('../src/renderer/i18n/en').en;
    const locales = ['ar', 'de', 'es', 'fr', 'ja', 'tr', 'zh'];

    const enKeys = new Set(flattenKeys(en));
    console.log(`Base (en) has ${enKeys.size} keys.`);

    for (const lang of locales) {
        try {
            const mod = require(`../src/renderer/i18n/${lang}`);
            const data = mod[lang];
            if (!data) {
                console.error(`Could not find export ${lang} in ${lang}.ts`);
                continue;
            }

            const langKeys = new Set(flattenKeys(data));
            const missing = [...enKeys].filter(k => !langKeys.has(k));

            console.log(`\nLanguage: ${lang}`);
            console.log(`Total keys: ${langKeys.size}`);
            console.log(`Missing keys: ${missing.length}`);

            if (missing.length > 0) {
                // Determine if we should print all
                if (missing.length > 20) {
                    console.log(`First 20 missing keys:`);
                    missing.slice(0, 20).forEach(k => console.log(`  - ${k}`));
                    console.log(`  ... and ${missing.length - 20} more.`);
                } else {
                    missing.forEach(k => console.log(`  - ${k}`));
                }

                // Also check for extra keys?
                const extra = [...langKeys].filter(k => !enKeys.has(k));
                if (extra.length > 0) {
                    console.log(`Extra keys (not in en): ${extra.length}`);
                    // extra.forEach(k => console.log(`  + ${k}`));
                }
            } else {
                console.log("No missing keys.");
            }

        } catch (e) {
            console.error(`Error processing ${lang}:`, e);
        }
    }
}

audit();
