
'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const vm = require('vm');

const I18N_DIR = path.resolve(__dirname, '..', 'src', 'renderer', 'i18n');
const CHECKPOINT_DIR = path.resolve(__dirname, '..', 'logs');
const LOCALES_TO_UPDATE = ['tr', 'de', 'fr', 'es', 'ar', 'ja', 'zh'];

// --- Protected terms: never translate these ---
const PROTECTED_TERMS = [
    'IPC', 'UI', 'UX', 'API', 'SDK', 'CLI', 'LLM', 'GPU', 'CPU',
    'JSON', 'JSON-LD', 'Markdown', 'TypeScript', 'JavaScript', 'React', 'Electron',
    'Vitest', 'Playwright', 'OpenAI', 'Anthropic', 'Ollama', 'HuggingFace',
    'Pollinations', 'fallback', 'Fallback', 'handler', 'Handler', 'handlers', 'Handlers',
    'wrapper', 'Wrapper', 'wrappers', 'Wrappers', 'runtime', 'Runtime', 'branch', 'Branch',
    'Tandem', 'Antigravity', 'Claude', 'Copilot', 'Codex', 'GitHub', 'Groq', 'DeepSeek',
    'Qwen', 'Phi', 'Llama', 'Mistral', 'Dracula', 'Monokai', 'Nord', 'Solarized',
    'Docker', 'SSH', 'Nginx', 'MCP', 'RTL', 'FIFO', 'ANSI', 'RSA', 'GGUF',
    'OpenCode', 'HuggingFace', 'Civitai', 'Pollinations', 'PGlite',
];

// --- Utilities ---

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
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
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

async function translateRaw(text, locale) {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${locale}&dt=t&q=${encodeURIComponent(text)}`;
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

function maskPlaceholders(text) {
    return maskWithRegex(text, /{{[^}]+}}/g, 'VARTOKEN');
}

function restorePlaceholders(text, tokens) {
    return restoreMasked(text, 'VARTOKEN', tokens);
}

function applyLocalePolish(text) {
    if (typeof text !== 'string' || text.length === 0) return text;
    let output = text;
    output = output.replace(/\s+:/g, ':');
    // Fix spacing around interpolation tokens that may have been mangled
    output = output.replace(/\{\s*\{/g, '{{').replace(/\}\s*\}/g, '}}');
    return output;
}

async function translateText(text, locale, cache) {
    if (!text) return text;
    // Skip pure-variable strings
    if (/^{{[^}]+}}$/.test(text.trim())) return text;
    // Skip very short non-alphabetic strings
    if (!/[A-Za-z]/.test(text)) return text;

    const cacheKey = `${locale}::${text}`;
    if (cache[cacheKey]) return cache[cacheKey];

    const codeMasked = maskCodeSpans(text);
    const varMasked = maskPlaceholders(codeMasked.masked);
    const termMasked = maskProtectedTerms(varMasked.masked);

    // If nothing left to translate after masking, return original
    if (!termMasked.masked.trim() || !/[A-Za-z]/.test(termMasked.masked)) {
        return text;
    }

    let translated = '';
    let attempt = 0;
    while (attempt < 5) {
        try {
            translated = await translateRaw(termMasked.masked, locale);
            break;
        } catch (error) {
            attempt += 1;
            if (attempt >= 5) {
                console.error(`  [WARN] Failed to translate "${text.substring(0, 40)}..." to ${locale}`);
                return text; // Fallback to English
            }
            await sleep(300 * attempt);
        }
    }

    let restored = restoreProtectedTerms(translated, termMasked.tokens);
    restored = restorePlaceholders(restored, varMasked.tokens);
    restored = restoreMasked(restored, 'CODETOKEN', codeMasked.tokens);
    restored = applyLocalePolish(restored);

    cache[cacheKey] = restored;
    return restored;
}

// --- File Loading ---

function loadLocaleObject(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    // Replace "export const <name> =" with "this.<name> =" to capture in sandbox
    const scriptContent = content.replace(/export\s+const\s+(\w+)\s*=/, 'this.$1 =');
    const sandbox = {};
    vm.createContext(sandbox);
    try {
        vm.runInContext(scriptContent, sandbox);
        const keys = Object.keys(sandbox);
        if (keys.length > 0) return { name: keys[0], obj: sandbox[keys[0]] };
    } catch (e) {
        console.error(`Failed to eval ${filePath}:`, e.message);
    }
    return null;
}

function loadCheckpoint(locale) {
    const checkpointPath = path.join(CHECKPOINT_DIR, `i18n-checkpoint-${locale}.json`);
    if (fs.existsSync(checkpointPath)) {
        try {
            return JSON.parse(fs.readFileSync(checkpointPath, 'utf8'));
        } catch {
            return {};
        }
    }
    return {};
}

function saveCheckpoint(locale, cache) {
    fs.mkdirSync(CHECKPOINT_DIR, { recursive: true });
    const checkpointPath = path.join(CHECKPOINT_DIR, `i18n-checkpoint-${locale}.json`);
    fs.writeFileSync(checkpointPath, JSON.stringify(cache, null, 2), 'utf8');
}

// --- Core Logic ---

/**
 * Recursively fills missing keys in targetObj from enObj, translating string values.
 * Preserves EN key order.
 */
async function fillMissing(enObj, targetObj, locale, cache, prefix) {
    let modified = false;
    let count = 0;

    for (const key of Object.keys(enObj)) {
        const enValue = enObj[key];
        if (enValue === null || enValue === undefined) continue;

        const targetValue = targetObj[key];

        if (targetValue === undefined) {
            if (typeof enValue === 'object' && !Array.isArray(enValue)) {
                targetObj[key] = {};
                await fillMissing(enValue, targetObj[key], locale, cache, `${prefix}${key}.`);
                modified = true;
            } else if (typeof enValue === 'string') {
                const translated = await translateText(enValue, locale, cache);
                targetObj[key] = translated;
                count += 1;
                if (count % 20 === 0) {
                    console.log(`  [${locale}] ${prefix}${key} → translated (${count} done so far)`);
                    saveCheckpoint(locale, cache);
                }
                modified = true;
                await sleep(80); // Gentle rate limit
            }
        } else if (typeof enValue === 'object' && !Array.isArray(enValue)) {
            if (typeof targetValue !== 'object' || targetValue === null) {
                targetObj[key] = {};
                await fillMissing(enValue, targetObj[key], locale, cache, `${prefix}${key}.`);
                modified = true;
            } else {
                const subMod = await fillMissing(enValue, targetValue, locale, cache, `${prefix}${key}.`);
                if (subMod) modified = true;
            }
        }
        // String key exists → skip (don't re-translate)
    }
    return modified;
}

/**
 * Serializes a JS object to a TypeScript-compatible export string.
 * Uses JSON.stringify for simplicity — valid TS/JS.
 */
function serializeToTs(name, obj) {
    const json = JSON.stringify(obj, null, 4);
    return `// ${name.toUpperCase()} translations\nexport const ${name} = ${json};\n`;
}

async function processLocale(locale) {
    const filePath = path.join(I18N_DIR, `${locale}.ts`);
    const enPath = path.join(I18N_DIR, 'en.ts');

    if (!fs.existsSync(filePath)) {
        console.error(`[${locale}] File not found: ${filePath}`);
        return;
    }

    const enResult = loadLocaleObject(enPath);
    const targetResult = loadLocaleObject(filePath);

    if (!enResult || !targetResult) {
        console.error(`[${locale}] Failed to load locale objects`);
        return;
    }

    const cache = loadCheckpoint(locale);
    console.log(`\n[${locale}] Starting... (checkpoint has ${Object.keys(cache).length} cached translations)`);

    const changed = await fillMissing(enResult.obj, targetResult.obj, locale, cache, '');

    if (changed) {
        const content = serializeToTs(targetResult.name, targetResult.obj);
        fs.writeFileSync(filePath, content, 'utf8');
        saveCheckpoint(locale, cache);
        console.log(`[${locale}] ✓ Updated and saved.`);
    } else {
        console.log(`[${locale}] No changes needed.`);
    }
}

async function run() {
    const args = process.argv.slice(2);
    const locales = args.length > 0 ? args : LOCALES_TO_UPDATE;

    console.log(`Running i18n translation for: ${locales.join(', ')}`);

    for (const locale of locales) {
        await processLocale(locale);
    }

    console.log('\nAll done!');
}

run().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
