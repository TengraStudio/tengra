 
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const SOURCE_FILE = path.join(ROOT_DIR, 'docs', 'changelog', 'data', 'changelog.entries.json');
const LOCALES_DIR = path.join(ROOT_DIR, 'docs', 'changelog', 'i18n');
const LOCALES_CONFIG_FILE = path.join(LOCALES_DIR, 'locales.json');

function fail(message) {
    console.error(`Changelog quality check failed: ${message}`);
    process.exit(1);
}

function normalize(value) {
    return String(value ?? '').trim();
}

function run() {
    const source = JSON.parse(fs.readFileSync(SOURCE_FILE, 'utf8'));
    const localeConfig = JSON.parse(fs.readFileSync(LOCALES_CONFIG_FILE, 'utf8'));
    const locales = Array.isArray(localeConfig.locales) ? localeConfig.locales : [];
    const overrideLocales = locales.filter((locale) => locale.code !== 'en' && locale.validateOverrides !== false);
    const overridesByLocale = Object.fromEntries(
        overrideLocales.map((locale) => {
            const filePath = path.join(LOCALES_DIR, `${locale.code}.overrides.json`);
            if (!fs.existsSync(filePath)) {
                fail(`Missing locale override file: ${filePath}`);
            }
            return [locale.code, JSON.parse(fs.readFileSync(filePath, 'utf8'))];
        })
    );
    const entries = source.entries ?? [];

    if (!Array.isArray(entries) || entries.length === 0) {
        fail('changelog.entries.json does not contain any entries.');
    }

    for (const entry of entries) {
        if (!entry.id) {
            fail('Entry without id.');
        }

        const en = entry.translations?.en;
        if (!en) {
            fail(`Missing EN translation for ${entry.id}.`);
        }

        if (normalize(en.title).length === 0) {
            fail(`Missing EN title for ${entry.id}.`);
        }
        if (normalize(en.summary).length === 0) {
            fail(`Missing EN summary for ${entry.id}.`);
        }
        if (!Array.isArray(en.items) || en.items.length === 0) {
            fail(`Missing EN items for ${entry.id}.`);
        }

        for (const locale of overrideLocales) {
            const localized = overridesByLocale[locale.code]?.[entry.id];
            if (!localized) {
                fail(`Missing ${locale.code.toUpperCase()} override for ${entry.id}.`);
            }
            if (normalize(localized.title).length === 0) {
                fail(`Missing ${locale.code.toUpperCase()} title for ${entry.id}.`);
            }
            if (normalize(localized.summary).length === 0) {
                fail(`Missing ${locale.code.toUpperCase()} summary for ${entry.id}.`);
            }
            if (!Array.isArray(localized.items) || localized.items.length === 0) {
                fail(`Missing ${locale.code.toUpperCase()} items for ${entry.id}.`);
            }
        }
    }

    console.log(`Changelog quality check passed for ${entries.length} entries.`);
}

run();

