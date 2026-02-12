const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const SOURCE_FILE = path.join(ROOT_DIR, 'docs', 'changelog', 'data', 'changelog.entries.json');
const LOCALES_DIR = path.join(ROOT_DIR, 'docs', 'changelog', 'i18n');
const LOCALES_CONFIG_FILE = path.join(LOCALES_DIR, 'locales.json');

function readJson(filePath, fallback) {
    if (!fs.existsSync(filePath)) {
        return fallback;
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function run() {
    const source = readJson(SOURCE_FILE, null);
    if (!source || !Array.isArray(source.entries)) {
        throw new Error('Invalid changelog source');
    }

    const localeConfig = readJson(LOCALES_CONFIG_FILE, null);
    const locales = (localeConfig?.locales ?? [])
        .filter((locale) => locale.code !== 'en')
        .map((locale) => locale.code);

    for (const locale of locales) {
        const filePath = path.join(LOCALES_DIR, `${locale}.overrides.json`);
        const overrides = readJson(filePath, {});
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

        writeJson(filePath, overrides);
        console.log(`${locale}: seeded ${created} entries`);
    }
}

run();
