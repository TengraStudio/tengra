 
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const SOURCE_FILE = path.join(ROOT_DIR, 'docs', 'changelog', 'data', 'changelog.entries.json');
const OVERRIDES_FILE = path.join(
    ROOT_DIR,
    'docs',
    'changelog',
    'i18n',
    'tr.overrides.json'
);
const CACHE_FILE = path.join(
    ROOT_DIR,
    'docs',
    'changelog',
    'i18n',
    '.tr.translation.cache.json'
);

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

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function canSkipTranslate(text) {
    if (!text || text.trim().length === 0) {
        return true;
    }
    const withoutCode = text.replace(/`[^`]*`/g, '');
    return !/[A-Za-z]/.test(withoutCode);
}

function request(url) {
    return new Promise((resolve, reject) => {
        https
            .get(url, (res) => {
                if (res.statusCode && res.statusCode >= 400) {
                    reject(new Error(`HTTP ${res.statusCode}`));
                    res.resume();
                    return;
                }
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    resolve(data);
                });
            })
            .on('error', reject);
    });
}

async function translateRaw(text) {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=tr&dt=t&q=${encodeURIComponent(text)}`;
    const payload = await request(url);
    const parsed = JSON.parse(payload);
    if (!Array.isArray(parsed) || !Array.isArray(parsed[0])) {
        throw new Error('Unexpected translate payload');
    }
    return parsed[0].map((segment) => segment[0]).join('');
}

function maskCodeSpans(text) {
    const tokens = [];
    const masked = text.replace(/`[^`]*`/g, (match) => {
        const key = `__CODETOKEN_${tokens.length}__`;
        tokens.push(match);
        return key;
    });
    return { masked, tokens };
}

function restoreCodeSpans(text, tokens) {
    let restored = text;
    for (let i = 0; i < tokens.length; i += 1) {
        restored = restored.replaceAll(`__CODETOKEN_${i}__`, tokens[i]);
    }
    return restored;
}

async function translateText(text, cache) {
    if (canSkipTranslate(text)) {
        return text;
    }

    if (cache[text]) {
        return cache[text];
    }

    const { masked, tokens } = maskCodeSpans(text);

    let translated;
    let attempt = 0;
    while (attempt < 5) {
        try {
            translated = await translateRaw(masked);
            break;
        } catch (error) {
            attempt += 1;
            if (attempt >= 5) {
                console.error(`Failed to translate after retries: ${text}`);
                throw error;
            }
            await sleep(400 * attempt);
        }
    }

    const restored = restoreCodeSpans(translated, tokens);
    cache[text] = restored;
    return restored;
}

async function run() {
    const source = readJson(SOURCE_FILE, null);
    if (!source || !Array.isArray(source.entries)) {
        throw new Error('Invalid changelog source');
    }

    const existingOverrides = readJson(OVERRIDES_FILE, {});
    const cache = readJson(CACHE_FILE, {});
    const overrides = { ...existingOverrides };

    let processed = 0;
    const total = source.entries.length;

    for (const entry of source.entries) {
        const en = entry.translations?.en;
        if (!en) {
            continue;
        }

        const title = await translateText(en.title ?? '', cache);
        const summary = await translateText(en.summary ?? '', cache);
        const items = [];

        for (const line of en.items ?? []) {
            items.push(await translateText(line, cache));
            await sleep(25);
        }

        overrides[entry.id] = { title, summary, items };
        processed += 1;

        if (processed % 5 === 0 || processed === total) {
            writeJson(OVERRIDES_FILE, overrides);
            writeJson(CACHE_FILE, cache);
            console.log(`Translated ${processed}/${total} entries`);
        }
    }

    writeJson(OVERRIDES_FILE, overrides);
    writeJson(CACHE_FILE, cache);
    console.log(`TR overrides completed: ${Object.keys(overrides).length} entries`);
}

run().catch((error) => {
    console.error(error);
    process.exit(1);
});

