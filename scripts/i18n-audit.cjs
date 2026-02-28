#!/usr/bin/env node
/**
 * i18n Translation Audit Script
 *
 * Audits translation files for:
 * - Missing keys (keys present in English but absent in other languages)
 * - Extra keys (keys present in other languages but absent in English)
 * - Untranslated values (values identical to English, suggesting missing translation)
 * - Duplicate values within a language (possible copy-paste errors)
 *
 * Usage: node scripts/i18n-audit.cjs [--verbose] [--lang <code>]
 */

const fs = require('fs');
const path = require('path');

const I18N_DIR = path.join(__dirname, '..', 'src', 'renderer', 'i18n');
const LANG_CODES = ['tr', 'de', 'fr', 'es', 'ja', 'zh', 'ar'];

/**
 * Extracts the exported object from a .ts translation file by evaluating its structure.
 * @param {string} filePath - Path to the .ts translation file
 * @returns {Record<string, unknown>} The parsed translation object
 */
function parseTranslationFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');

    // Strip the export const and trailing semicolons to get pure object literal
    const objectMatch = content.match(/export\s+const\s+\w+\s*=\s*(\{[\s\S]*\})\s*;?\s*$/);
    if (!objectMatch) {
        throw new Error(`Could not parse translation file: ${filePath}`);
    }

    // Use Function constructor to evaluate the object literal safely
    const evaluate = new Function(`return (${objectMatch[1]});`);
    return evaluate();
}

/**
 * Flattens a nested object into dot-notation key-value pairs.
 * @param {Record<string, unknown>} obj - Object to flatten
 * @param {string} prefix - Current key prefix
 * @returns {Map<string, string>} Flattened key-value map
 */
function flattenObject(obj, prefix = '') {
    const result = new Map();

    for (const key of Object.keys(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        const value = obj[key];

        if (typeof value === 'string') {
            result.set(fullKey, value);
        } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
            const nested = flattenObject(value, fullKey);
            for (const [nestedKey, nestedValue] of nested) {
                result.set(nestedKey, nestedValue);
            }
        }
    }

    return result;
}

/**
 * Audits a single language against the English reference.
 * @param {Map<string, string>} enKeys - Flattened English keys
 * @param {Map<string, string>} langKeys - Flattened target language keys
 * @param {string} langCode - The language code being audited
 * @returns {{ missing: string[], extra: string[], untranslated: string[] }}
 */
function auditLanguage(enKeys, langKeys, langCode) {
    const missing = [];
    const extra = [];
    const untranslated = [];

    for (const [key, enValue] of enKeys) {
        if (!langKeys.has(key)) {
            missing.push(key);
        } else if (langKeys.get(key) === enValue && enValue.length > 3) {
            // Flag identical strings longer than 3 chars as potentially untranslated
            // (short strings like "OK", "PDF" are often the same across languages)
            untranslated.push(key);
        }
    }

    for (const key of langKeys.keys()) {
        if (!enKeys.has(key)) {
            extra.push(key);
        }
    }

    return { missing, extra, untranslated };
}

/**
 * Finds duplicate values within a single language file.
 * @param {Map<string, string>} langKeys - Flattened language keys
 * @returns {Map<string, string[]>} Map of duplicated value to array of keys sharing it
 */
function findDuplicateValues(langKeys) {
    /** @type {Map<string, string[]>} */
    const valueToKeys = new Map();

    for (const [key, value] of langKeys) {
        if (value.length <= 3) continue;
        const existing = valueToKeys.get(value);
        if (existing) {
            existing.push(key);
        } else {
            valueToKeys.set(value, [key]);
        }
    }

    /** @type {Map<string, string[]>} */
    const duplicates = new Map();
    for (const [value, keys] of valueToKeys) {
        if (keys.length > 1) {
            duplicates.set(value, keys);
        }
    }

    return duplicates;
}

// ──────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────

const args = process.argv.slice(2);
const verbose = args.includes('--verbose');
const langFilter = args.includes('--lang') ? args[args.indexOf('--lang') + 1] : null;
const langsToAudit = langFilter ? [langFilter] : LANG_CODES;

console.log('╔══════════════════════════════════════════════╗');
console.log('║        Tengra i18n Translation Audit         ║');
console.log('╚══════════════════════════════════════════════╝\n');

let enObj;
try {
    enObj = parseTranslationFile(path.join(I18N_DIR, 'en.ts'));
} catch (err) {
    console.error('Failed to parse English reference file:', err.message);
    process.exit(1);
}

const enKeys = flattenObject(enObj);
console.log(`Reference (en): ${enKeys.size} keys\n`);

let totalMissing = 0;
let totalExtra = 0;
let totalUntranslated = 0;

for (const lang of langsToAudit) {
    const filePath = path.join(I18N_DIR, `${lang}.ts`);
    if (!fs.existsSync(filePath)) {
        console.log(`⚠  ${lang}.ts not found, skipping.\n`);
        continue;
    }

    let langObj;
    try {
        langObj = parseTranslationFile(filePath);
    } catch (err) {
        console.log(`⚠  ${lang}.ts parse error: ${err.message}\n`);
        continue;
    }

    const langKeys = flattenObject(langObj);
    const { missing, extra, untranslated } = auditLanguage(enKeys, langKeys, lang);

    totalMissing += missing.length;
    totalExtra += extra.length;
    totalUntranslated += untranslated.length;

    const coverage = ((langKeys.size - extra.length) / enKeys.size * 100).toFixed(1);
    console.log(`── ${lang.toUpperCase()} ── (${langKeys.size} keys, ${coverage}% coverage)`);
    console.log(`   Missing: ${missing.length} | Extra: ${extra.length} | Untranslated: ${untranslated.length}`);

    if (verbose && missing.length > 0) {
        console.log('   Missing keys:');
        for (const key of missing.slice(0, 20)) {
            console.log(`     - ${key}`);
        }
        if (missing.length > 20) {
            console.log(`     ... and ${missing.length - 20} more`);
        }
    }

    if (verbose && untranslated.length > 0) {
        console.log('   Potentially untranslated:');
        for (const key of untranslated.slice(0, 10)) {
            console.log(`     - ${key}: "${enKeys.get(key)}"`);
        }
        if (untranslated.length > 10) {
            console.log(`     ... and ${untranslated.length - 10} more`);
        }
    }

    console.log('');
}

// Duplicate check on English
const enDuplicates = findDuplicateValues(enKeys);
if (enDuplicates.size > 0) {
    console.log(`── EN Duplicate Values ── (${enDuplicates.size} duplicated strings)`);
    if (verbose) {
        let shown = 0;
        for (const [value, keys] of enDuplicates) {
            if (shown >= 10) {
                console.log(`   ... and ${enDuplicates.size - 10} more`);
                break;
            }
            console.log(`   "${value.substring(0, 50)}${value.length > 50 ? '...' : ''}" → ${keys.length} keys`);
            shown++;
        }
    }
    console.log('');
}

// Summary
console.log('════════════════════════════════════════════════');
console.log(`Total: ${totalMissing} missing, ${totalExtra} extra, ${totalUntranslated} untranslated`);

if (totalMissing === 0 && totalExtra === 0) {
    console.log('✅ All translation files are in sync with English reference.');
} else {
    console.log('⚠  Some translation issues found. Run with --verbose for details.');
}
