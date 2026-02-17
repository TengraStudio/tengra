const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const I18N_DIR = path.join(__dirname, '../src/renderer/i18n');
const LOCALES = ['ar', 'de', 'es', 'fr', 'ja', 'tr', 'zh'];
const ENGLISH_FILE = path.join(I18N_DIR, 'en.ts');

function parseTsFile(filePath) {
    const code = fs.readFileSync(filePath, 'utf8');
    const result = ts.transpileModule(code, {
        compilerOptions: { module: ts.ModuleKind.CommonJS }
    });
    const tempFile = filePath.replace('.ts', '.temp.js');
    fs.writeFileSync(tempFile, result.outputText);
    try {
        const module = require(tempFile);
        return module.default || module;
    } finally {
        fs.unlinkSync(tempFile);
    }
}

function traverse(obj, prefix = '') {
    let keys = {};
    for (const key in obj) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
            Object.assign(keys, traverse(obj[key], prefix + key + '.'));
        } else {
            keys[prefix + key] = obj[key];
        }
    }
    return keys;
}

function getPlaceholders(text) {
    const matches = text.match(/{{(.*?)}}/g);
    return matches ? matches.map(m => m.replace(/{{|}}/g, '').trim()).sort() : [];
}

function checkQuality() {
    console.log('--- Translation Quality Check ---');
    let errors = 0;

    try {
        const enData = parseTsFile(ENGLISH_FILE);
        const enKeys = traverse(enData);

        for (const locale of LOCALES) {
            const localeFile = path.join(I18N_DIR, `${locale}.ts`);
            if (!fs.existsSync(localeFile)) {
                console.warn(`[WARN] Missing locale file: ${locale}.ts`);
                continue;
            }

            console.log(`Checking ${locale}...`);
            const localeData = parseTsFile(localeFile);
            const localeKeys = traverse(localeData);

            for (const key in enKeys) {
                if (!localeKeys[key]) continue; // Missing keys handled by audit script

                const enText = String(enKeys[key]);
                const localeText = String(localeKeys[key]);

                // 1. Placeholder Check
                const enPlaceholders = getPlaceholders(enText);
                const localePlaceholders = getPlaceholders(localeText);

                if (JSON.stringify(enPlaceholders) !== JSON.stringify(localePlaceholders)) {
                    console.error(`[ERROR] [${locale}] Placeholder mismatch in '${key}'`);
                    console.error(`  EN: ${enPlaceholders.join(', ')}`);
                    console.error(`  ${locale.toUpperCase()}: ${localePlaceholders.join(', ')}`);
                    errors++;
                }

                // 2. Whitespace Check
                if (enText.trim() !== '' && localeText.trim() !== '') {
                    const enLeading = enText.match(/^\s+/);
                    const localeLeading = localeText.match(/^\s+/);
                    if ((enLeading && !localeLeading) || (!enLeading && localeLeading)) {
                        console.warn(`[WARN] [${locale}] Leading whitespace mismatch in '${key}'`);
                    }
                }
            }
        }
    } catch (err) {
        console.error('Fatal error during check:', err);
        process.exit(1);
    }

    if (errors > 0) {
        console.error(`\nFound ${errors} critical errors.`);
        process.exit(1);
    } else {
        console.log('\nQuality check passed!');
        process.exit(0);
    }
}

checkQuality();
