const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const SOURCE_FILE = path.join(ROOT_DIR, 'docs', 'changelog', 'data', 'changelog.entries.json');
const LOCALES_DIR = path.join(ROOT_DIR, 'docs', 'changelog', 'i18n');

function parseLocaleArg() {
    const localeArg = process.argv.find((arg) => arg.startsWith('--locale='));
    if (!localeArg) {
        throw new Error('Usage: node scripts/changelog/seed-overrides.cjs --locale=<code>');
    }
    const locale = localeArg.split('=')[1]?.trim();
    if (!locale || locale.length < 2 || locale === 'en') {
        throw new Error('Locale must be non-empty and not "en".');
    }
    return locale;
}

function readJson(filePath, fallback) {
    if (!fs.existsSync(filePath)) {
        return fallback;
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function run() {
    const locale = parseLocaleArg();
    const source = readJson(SOURCE_FILE, null);
    if (!source || !Array.isArray(source.entries)) {
        throw new Error('Invalid changelog source.');
    }

    const overridePath = path.join(LOCALES_DIR, `${locale}.overrides.json`);
    const overrides = readJson(overridePath, {});

    let created = 0;
    for (const entry of source.entries) {
        if (overrides[entry.id]) {
            continue;
        }
        const en = entry.translations?.en;
        if (!en) {
            continue;
        }
        overrides[entry.id] = {
            title: en.title,
            summary: en.summary,
            items: Array.isArray(en.items) ? en.items : [],
        };
        created += 1;
    }

    fs.mkdirSync(path.dirname(overridePath), { recursive: true });
    fs.writeFileSync(overridePath, `${JSON.stringify(overrides, null, 2)}\n`, 'utf8');
    console.log(`Seeded ${created} new overrides for locale "${locale}".`);
}

run();
