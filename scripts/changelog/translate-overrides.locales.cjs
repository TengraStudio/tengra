const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const SOURCE_FILE = path.join(ROOT_DIR, 'docs', 'changelog', 'data', 'changelog.entries.json');
const I18N_DIR = path.join(ROOT_DIR, 'docs', 'changelog', 'i18n');
const LOCALES_FILE = path.join(I18N_DIR, 'locales.json');

const DEFAULT_LOCALES = ['de', 'fr', 'es', 'ja', 'zh', 'ar'];
const PROTECTED_TERMS = [
    'IPC', 'UI', 'UX', 'API', 'SDK', 'CLI', 'LLM', 'GPU', 'CPU',
    'JSON', 'JSON-LD', 'Markdown', 'TypeScript', 'JavaScript', 'React', 'Electron',
    'Vitest', 'Playwright', 'OpenAI', 'Anthropic', 'Ollama', 'HuggingFace',
    'Pollinations', 'fallback', 'Fallback', 'handler', 'Handler', 'handlers', 'Handlers',
    'wrapper', 'Wrapper', 'wrappers', 'Wrappers', 'runtime', 'Runtime', 'branch', 'Branch'
];

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

function normalize(value) {
    return String(value ?? '').trim();
}

function sameText(a, b) {
    return normalize(a) === normalize(b);
}

function parseArgs() {
    const args = process.argv.slice(2);
    const map = {};
    for (const arg of args) {
        if (!arg.startsWith('--')) {
            continue;
        }
        const body = arg.slice(2);
        if (!body.includes('=')) {
            map[body] = true;
            continue;
        }
        const [rawKey, ...rest] = body.split('=');
        map[rawKey] = rest.join('=');
    }
    return map;
}

function getTargetLocales(args, localeRegistry) {
    const raw = typeof args.locales === 'string' && args.locales.length > 0
        ? args.locales.split(',').map((locale) => locale.trim()).filter(Boolean)
        : DEFAULT_LOCALES;
    const validLocales = new Set((localeRegistry?.locales ?? []).map((l) => l.code));
    return raw.filter((locale) => validLocales.has(locale) && locale !== 'en');
}

function request(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if (res.statusCode && res.statusCode >= 400) {
                reject(new Error(`HTTP ${res.statusCode}`));
                res.resume();
                return;
            }
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

async function translateRaw(text, locale) {
    const url =
        `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${locale}&dt=t&q=${encodeURIComponent(text)}`;
    const payload = await request(url);
    const parsed = JSON.parse(payload);
    if (!Array.isArray(parsed) || !Array.isArray(parsed[0])) {
        throw new Error('Unexpected translation payload');
    }
    return parsed[0].map((segment) => segment[0]).join('');
}

function maskWithRegex(text, regex, prefix) {
    const tokens = [];
    const masked = text.replace(regex, (match) => {
        const key = `__${prefix}_${tokens.length}__`;
        tokens.push(match);
        return key;
    });
    return { masked, tokens };
}

function restoreMasked(text, prefix, tokens) {
    let output = text;
    for (let i = 0; i < tokens.length; i += 1) {
        output = output.replaceAll(`__${prefix}_${i}__`, tokens[i]);
    }
    return output;
}

function maskCodeSpans(text) {
    return maskWithRegex(text, /`[^`]*`/g, 'CODETOKEN');
}

function maskProtectedTerms(text) {
    let output = text;
    const tokens = [];

    for (const term of PROTECTED_TERMS) {
        const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escaped}\\b`, 'g');
        output = output.replace(regex, (match) => {
            const key = `__TERMTOKEN_${tokens.length}__`;
            tokens.push(match);
            return key;
        });
    }

    return { masked: output, tokens };
}

function restoreProtectedTerms(text, tokens) {
    return restoreMasked(text, 'TERMTOKEN', tokens);
}

function canSkipTranslate(text) {
    const value = normalize(text);
    if (!value) {
        return true;
    }
    if (/^##\s*\[\d{4}-\d{2}-\d{2}\]/.test(value)) {
        return true;
    }
    if (value === '```' || value.startsWith('```')) {
        return true;
    }
    if (value === '}' || value === '{' || value === '});' || value === ');' || value === '},') {
        return true;
    }

    const withoutCode = value.replace(/`[^`]*`/g, '');
    if (!/[A-Za-z]/.test(withoutCode)) {
        return true;
    }
    return false;
}

function getCacheFile(locale) {
    return path.join(I18N_DIR, `.${locale}.translation.cache.json`);
}

function applyLocalePolish(text, locale) {
    if (typeof text !== 'string' || text.length === 0) {
        return text;
    }

    let output = text;
    if (locale === 'de') {
        output = output.replace(/\bMarktplatz\b/g, 'Marketplace');
    } else if (locale === 'fr') {
        output = output.replace(/\bmarché\b/g, 'marketplace');
    } else if (locale === 'es') {
        output = output.replace(/\bmercado\b/g, 'marketplace');
    } else if (locale === 'ja') {
        output = output.replace(/マーケットプレイス/g, 'Marketplace');
    } else if (locale === 'zh') {
        output = output.replace(/市场/g, 'Marketplace');
    } else if (locale === 'ar') {
        output = output.replace(/السوق/g, 'Marketplace');
    }

    output = output.replace(/\s+:/g, ':');
    return output;
}

async function translateText(text, locale, cache) {
    if (canSkipTranslate(text)) {
        return text;
    }

    const key = normalize(text);
    if (cache[key]) {
        return cache[key];
    }

    const codeMasked = maskCodeSpans(text);
    const termMasked = maskProtectedTerms(codeMasked.masked);

    let translated = '';
    let attempt = 0;
    while (attempt < 5) {
        try {
            translated = await translateRaw(termMasked.masked, locale);
            break;
        } catch (error) {
            attempt += 1;
            if (attempt >= 5) {
                throw error;
            }
            await sleep(300 * attempt);
        }
    }

    let restored = restoreProtectedTerms(translated, termMasked.tokens);
    restored = restoreMasked(restored, 'CODETOKEN', codeMasked.tokens);
    restored = applyLocalePolish(restored, locale);
    cache[key] = restored;
    return restored;
}

async function processLocale(locale, sourceEntries) {
    const overridesFile = path.join(I18N_DIR, `${locale}.overrides.json`);
    const overrides = readJson(overridesFile, {});
    const cacheFile = getCacheFile(locale);
    const cache = readJson(cacheFile, {});

    let translatedFields = 0;
    let touchedEntries = 0;
    const totalEntries = sourceEntries.length;

    for (let i = 0; i < totalEntries; i += 1) {
        const entry = sourceEntries[i];
        const en = entry.translations?.en;
        if (!en) {
            continue;
        }

        const current = overrides[entry.id] ?? {};
        let changed = false;

        if (!current.title || sameText(current.title, en.title)) {
            current.title = await translateText(en.title ?? '', locale, cache);
            translatedFields += 1;
            changed = true;
        }

        if (!current.summary || sameText(current.summary, en.summary)) {
            current.summary = await translateText(en.summary ?? '', locale, cache);
            translatedFields += 1;
            changed = true;
        }

        const enItems = Array.isArray(en.items) ? en.items : [];
        const currentItems = Array.isArray(current.items) ? [...current.items] : [];
        for (let idx = 0; idx < enItems.length; idx += 1) {
            const enItem = enItems[idx];
            const localizedItem = currentItems[idx];
            if (!localizedItem || sameText(localizedItem, enItem)) {
                currentItems[idx] = await translateText(enItem, locale, cache);
                translatedFields += 1;
                changed = true;
                await sleep(5);
            }
        }
        current.items = currentItems;

        if (changed) {
            overrides[entry.id] = current;
            touchedEntries += 1;
        }

        if ((i + 1) % 10 === 0 || i + 1 === totalEntries) {
            writeJson(overridesFile, overrides);
            writeJson(cacheFile, cache);
            console.log(`[${locale}] ${i + 1}/${totalEntries} entries processed`);
        }
    }

    writeJson(overridesFile, overrides);
    writeJson(cacheFile, cache);
    console.log(`[${locale}] completed. touchedEntries=${touchedEntries}, translatedFields=${translatedFields}`);
}

async function run() {
    const args = parseArgs();
    const source = readJson(SOURCE_FILE, null);
    if (!source || !Array.isArray(source.entries)) {
        throw new Error('Invalid changelog source');
    }

    const localesConfig = readJson(LOCALES_FILE, null);
    const locales = getTargetLocales(args, localesConfig);
    if (locales.length === 0) {
        throw new Error('No valid target locales');
    }

    for (const locale of locales) {
        await processLocale(locale, source.entries);
    }
}

run().catch((error) => {
    console.error(error);
    process.exit(1);
});
