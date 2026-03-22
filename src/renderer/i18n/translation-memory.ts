/**
 * Translation Memory utility.
 * Provides fuzzy matching to find similar existing translations.
 * Helps maintain consistency across language files.
 *
 * This is a development-time utility, not a runtime feature.
 */

import { en } from '@renderer/i18n/en';
import { tr } from '@renderer/i18n/tr';

/** Represents a stored translation pair */
export interface TranslationEntry {
    key: string;
    en: string;
    translations: Record<string, string>;
}

/** A translation entry enriched with a similarity score */
export interface ScoredTranslationEntry extends TranslationEntry {
    similarity: number;
}

/** Supported language codes for translation memory */
type LangCode = 'tr';

function toTranslationRecord<T extends object>(value: T): Record<string, RendererDataValue> {
    return value as Record<string, RendererDataValue>;
}

const LANG_MAP: Record<LangCode, Record<string, RendererDataValue>> = {
    tr: toTranslationRecord(tr)
};

/**
 * Computes the Levenshtein distance between two strings.
 * @param a - First string
 * @param b - Second string
 * @returns The edit distance between the two strings
 */
function levenshteinDistance(a: string, b: string): number {
    const lenA = a.length;
    const lenB = b.length;

    if (lenA === 0) { return lenB; }
    if (lenB === 0) { return lenA; }

    const matrix: number[][] = Array.from({ length: lenA + 1 }, () =>
        Array.from({ length: lenB + 1 }, () => 0)
    );

    for (let i = 0; i <= lenA; i++) {
        matrix[i][0] = i;
    }
    for (let j = 0; j <= lenB; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= lenA; i++) {
        for (let j = 1; j <= lenB; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j - 1] + cost
            );
        }
    }

    return matrix[lenA][lenB];
}

/**
 * Computes similarity between two strings (0 = no match, 1 = exact match).
 * @param a - First string
 * @param b - Second string
 * @returns Similarity score between 0 and 1
 */
export function computeSimilarity(a: string, b: string): number {
    const lowerA = a.toLowerCase();
    const lowerB = b.toLowerCase();

    if (lowerA === lowerB) { return 1; }

    const maxLen = Math.max(lowerA.length, lowerB.length);
    if (maxLen === 0) { return 1; }

    const distance = levenshteinDistance(lowerA, lowerB);
    return 1 - distance / maxLen;
}

/**
 * Flattens a nested translation object into dot-notation key-value pairs.
 * @param obj - Nested object to flatten
 * @param prefix - Current key prefix for recursion
 * @returns Map of flattened keys to string values
 */
function flattenObject(
    obj: Record<string, RendererDataValue>,
    prefix = ''
): Map<string, string> {
    const result = new Map<string, string>();

    for (const key of Object.keys(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        const value = obj[key];

        if (typeof value === 'string') {
            result.set(fullKey, value);
        } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
            const nested = flattenObject(value as Record<string, RendererDataValue>, fullKey);
            for (const [nestedKey, nestedValue] of nested) {
                result.set(nestedKey, nestedValue);
            }
        }
    }

    return result;
}

/**
 * Resolves a dot-notation key from a nested object.
 * @param obj - The nested object
 * @param key - Dot-notation key path
 * @returns The string value or undefined
 */
function resolveKey(obj: Record<string, RendererDataValue>, key: string): string | undefined {
    const parts = key.split('.');
    let current: RendererDataValue = obj;

    for (const part of parts) {
        if (current === null || typeof current !== 'object') { return undefined; }
        current = (current as Record<string, RendererDataValue>)[part];
    }

    return typeof current === 'string' ? current : undefined;
}

/**
 * Builds a translation memory index from all language files.
 * Returns entries that can be searched for similar strings.
 */
export function buildTranslationMemory(): TranslationEntry[] {
    const enFlat = flattenObject(toTranslationRecord(en));
    const entries: TranslationEntry[] = [];

    for (const [key, enValue] of enFlat) {
        const translations: Record<string, string> = {};

        for (const [langCode, langObj] of Object.entries(LANG_MAP)) {
            const translated = resolveKey(langObj, key);
            if (translated !== undefined) {
                translations[langCode] = translated;
            }
        }

        entries.push({ key, en: enValue, translations });
    }

    return entries;
}

/**
 * Finds existing translations that are similar to the given English string.
 * Uses Levenshtein distance for fuzzy matching.
 * @param query - The English string to find matches for
 * @param memory - The translation memory index
 * @param threshold - Similarity threshold (0-1), default 0.7
 * @returns Matching entries sorted by similarity (highest first)
 */
export function findSimilarTranslations(
    query: string,
    memory: TranslationEntry[],
    threshold = 0.7
): ScoredTranslationEntry[] {
    const results: ScoredTranslationEntry[] = [];

    for (const entry of memory) {
        const similarity = computeSimilarity(query, entry.en);
        if (similarity >= threshold) {
            results.push({ ...entry, similarity });
        }
    }

    results.sort((a, b) => b.similarity - a.similarity);
    return results;
}
