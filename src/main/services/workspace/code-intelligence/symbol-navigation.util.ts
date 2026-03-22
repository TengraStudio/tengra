/**
 * Symbol navigation utilities - find definitions, usages, implementations, relationships
 */

import { promises as fs } from 'fs';
import * as path from 'path';

import { appLogger } from '@main/logging/logger';
import { DatabaseService } from '@main/services/data/database.service';
import { FileSearchResult } from '@shared/types/common';
import { getErrorMessage } from '@shared/utils/error.util';

import { scanDirForSymbols, scanDirForText, scanDirRecursively } from './file-scanner.util';

const CODE_FILE_PATTERN = /\.(ts|tsx|js|jsx|py|go|rs|java|kt|kts|cpp|c|h|hpp|cs)$/i;
const MAX_FILE_PATH_RESULTS = 80;

function normalizeSearchValue(value: string): string {
    return value.trim().toLowerCase().replace(/\\/g, '/');
}

function calculateSubsequenceScore(candidate: string, query: string): number {
    let searchIndex = 0;
    let totalGapPenalty = 0;

    for (let queryIndex = 0; queryIndex < query.length; queryIndex++) {
        const character = query[queryIndex];
        if (!character) {
            break;
        }
        const matchIndex = candidate.indexOf(character, searchIndex);
        if (matchIndex === -1) {
            return -1;
        }
        totalGapPenalty += Math.max(0, matchIndex - searchIndex);
        searchIndex = matchIndex + 1;
    }

    return Math.max(5, 60 - totalGapPenalty);
}

export function scoreFilePathMatch(relativePath: string, query: string): number {
    const normalizedQuery = normalizeSearchValue(query);
    const normalizedPath = normalizeSearchValue(relativePath);
    const fileName = path.basename(normalizedPath);

    if (!normalizedQuery || !normalizedPath) {
        return -1;
    }

    if (fileName === normalizedQuery) {
        return 200;
    }
    if (fileName.startsWith(normalizedQuery)) {
        return 170;
    }
    if (fileName.includes(normalizedQuery)) {
        return 145;
    }
    if (normalizedPath.startsWith(normalizedQuery)) {
        return 120;
    }
    if (normalizedPath.includes(normalizedQuery)) {
        return 100;
    }

    const queryParts = normalizedQuery.split(/[\s/._-]+/).filter(Boolean);
    if (queryParts.length === 0) {
        return -1;
    }

    let score = 0;
    for (const part of queryParts) {
        const baseScore = calculateSubsequenceScore(fileName, part);
        const pathScore = calculateSubsequenceScore(normalizedPath, part);
        const partScore = Math.max(baseScore, pathScore);
        if (partScore < 0) {
            return -1;
        }
        score += partScore;
    }

    return score;
}

async function findFilePathMatches(rootPath: string, query: string): Promise<FileSearchResult[]> {
    const files: string[] = [];
    await scanDirRecursively(rootPath, files);

    return files
        .map(filePath => {
            const relativePath = path.relative(rootPath, filePath).replace(/\\/g, '/');
            const score = scoreFilePathMatch(relativePath, query);
            return {
                file: filePath,
                line: 1,
                text: relativePath,
                type: 'file',
                name: relativePath,
                score,
            };
        })
        .filter(result => result.score >= 0)
        .sort((left, right) => right.score - left.score || left.text.localeCompare(right.text))
        .slice(0, MAX_FILE_PATH_RESULTS)
        .map(({ score: _score, ...result }) => result);
}

/** Find symbols by name with indexed fallback to regex */
export async function findSymbols(
    db: DatabaseService,
    rootPath: string,
    query: string
): Promise<FileSearchResult[]> {
    try {
        const workspaces = await db.getWorkspaces();
        const ws = workspaces.find(p => p.path === rootPath || rootPath.startsWith(p.path));

        if (ws) {
            const dbSymbols = await db.findCodeSymbolsByName(ws.path, query);
            if (dbSymbols.length > 0) {
                return dbSymbols.map(s => ({
                    file: s.path,
                    line: s.line,
                    text: (s.signature && s.signature.length > 0) ? s.signature : s.name,
                    name: s.name,
                    type: s.kind
                }));
            }
        }
    } catch (e) {
        appLogger.warn('SymbolNavigation', `Index lookup failed for ${query}, falling back to regex`, e as Error);
    }

    const results: FileSearchResult[] = [];
    await scanDirForSymbols(rootPath, query, results);
    return results;
}

/** Hybrid search: indexed + semantic + regex fallback */
export async function searchFiles(
    db: DatabaseService,
    rootPath: string,
    query: string,
    workspaceId: string | undefined,
    isRegex: boolean = false
): Promise<FileSearchResult[]> {
    const results: FileSearchResult[] = [];
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
        return [];
    }
    appLogger.info('SymbolNavigation', `Starting search for "${query}" (regex=${isRegex}) workspace=${workspaceId} root=${rootPath}`);

    try {
        if (workspaceId || rootPath) {
            const symbols = await db.findCodeSymbolsByName(rootPath, trimmedQuery);
            results.push(...symbols.map(s => ({
                file: s.path, line: s.line,
                text: (s.signature && s.signature.length > 0) ? s.signature : s.name,
                name: s.name, type: s.kind
            })));

            const fragments = await db.searchCodeContentByText(rootPath, trimmedQuery);
            results.push(...fragments.map(f => ({
                file: f.path, line: f.line, text: f.docstring, type: 'content'
            })));
        }
    } catch (e) {
        appLogger.warn('SymbolNavigation', `Indexed search failed: ${getErrorMessage(e as Error)}`);
    }

    try {
        results.push(...await findFilePathMatches(rootPath, trimmedQuery));
    } catch (error) {
        appLogger.warn(
            'SymbolNavigation',
            `File path search failed for ${trimmedQuery}: ${getErrorMessage(error as Error)}`
        );
    }

    if (results.length < 20 || isRegex) {
        await scanDirForText(rootPath, trimmedQuery, isRegex, results);
    }

    return deduplicateResults(results, 500);
}

/** Find definition of a symbol */
export async function findDefinition(
    db: DatabaseService,
    rootPath: string,
    symbol: string
): Promise<FileSearchResult | null> {
    const trimmed = symbol.trim();
    if (!trimmed) { return null; }

    try {
        const candidates = await db.findCodeSymbolsByName(rootPath, trimmed);
        const exact = candidates.find(
            item => item.name.localeCompare(trimmed, undefined, { sensitivity: 'accent' }) === 0
        );
        const selected = exact ?? candidates[0];
        if (!selected) { return null; }
        return {
            file: selected.path,
            line: selected.line,
            text: selected.signature || selected.name,
            name: selected.name,
            type: selected.kind || 'symbol',
        };
    } catch (error) {
        appLogger.error('SymbolNavigation', `Failed to find definition for ${trimmed}`, error as Error);
        return null;
    }
}

/** Find all usages of a symbol via regex scan */
export async function findUsage(
    rootPath: string,
    symbol: string
): Promise<FileSearchResult[]> {
    const escapedSymbol = symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const results: FileSearchResult[] = [];
    await scanDirForText(rootPath, `\\b${escapedSymbol}\\b`, true, results);
    return results;
}

/** Scan a single file for implementation patterns */
async function scanFileForImplementations(
    filePath: string,
    patterns: Array<{ type: string; regex: RegExp }>,
    symbolName: string
): Promise<FileSearchResult[]> {
    const results: FileSearchResult[] = [];
    try {
        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.split(/\r?\n/);
        for (let index = 0; index < lines.length; index++) {
            const line = lines[index] ?? '';
            for (const pattern of patterns) {
                if (pattern.regex.test(line)) {
                    results.push({
                        file: filePath,
                        line: index + 1,
                        text: line.trim(),
                        type: pattern.type,
                        name: symbolName,
                    });
                    break;
                }
            }
        }
    } catch {
        // best-effort scan
    }
    return results;
}

/** Build implementation search patterns for a symbol */
function buildImplementationPatterns(escaped: string): Array<{ type: string; regex: RegExp }> {
    return [
        { type: 'implementation', regex: new RegExp(`\\bimplements\\s+[^\\n{]*\\b${escaped}\\b`, 'i') },
        { type: 'implementation', regex: new RegExp(`\\bextends\\s+${escaped}\\b`, 'i') },
        { type: 'implementation', regex: new RegExp(`\\bclass\\s+[A-Za-z0-9_]+\\s*:\\s*${escaped}\\b`, 'i') },
        { type: 'implementation', regex: new RegExp(`\\b${escaped}\\s*\\([^)]*\\)\\s*\\{`, 'i') },
    ];
}

/** Find implementations of a class/interface */
export async function findImplementations(
    rootPath: string,
    symbol: string
): Promise<FileSearchResult[]> {
    const trimmed = symbol.trim();
    if (!trimmed) { return []; }

    const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patterns = buildImplementationPatterns(escaped);

    const files: string[] = [];
    await scanDirRecursively(rootPath, files);
    const candidates = files.filter(f => CODE_FILE_PATTERN.test(f));

    const results: FileSearchResult[] = [];
    for (const filePath of candidates) {
        const fileResults = await scanFileForImplementations(filePath, patterns, trimmed);
        results.push(...fileResults);
    }

    return deduplicateResults(results, 500);
}

/** Find related symbols (same file, similar name, implementations) */
export async function getSymbolRelationships(
    db: DatabaseService,
    rootPath: string,
    symbol: string,
    maxItems: number = 200
): Promise<FileSearchResult[]> {
    const trimmed = symbol.trim();
    if (!trimmed) { return []; }

    try {
        const baseSymbols = await db.findCodeSymbolsByName(rootPath, trimmed);
        if (baseSymbols.length === 0) { return []; }

        const allSymbols = await db.getCodeSymbolsByWorkspacePath(rootPath);
        const results: FileSearchResult[] = [];

        for (const base of baseSymbols) {
            addSameFileRelationships(allSymbols, base, results);
            addSimilarNameRelationships(allSymbols, trimmed, results);
        }

        const implementations = await findImplementations(rootPath, trimmed);
        results.push(...implementations.map(item => ({ ...item, type: 'related-implementation' })));

        return deduplicateResultsWithType(results, Math.max(1, Math.min(maxItems, 1000)));
    } catch (error) {
        appLogger.error('SymbolNavigation', `Failed to resolve relationships for ${trimmed}`, error as Error);
        return [];
    }
}

/** Add same-file relationships to results */
function addSameFileRelationships(
    allSymbols: Array<{ path: string; line: number; name: string; signature: string }>,
    base: { path: string; line: number; name: string },
    results: FileSearchResult[]
): void {
    const sameFile = allSymbols.filter(item => item.path === base.path);
    for (const rel of sameFile) {
        if (rel.name === base.name && rel.line === base.line) { continue; }
        const distance = Math.abs((rel.line ?? 0) - (base.line ?? 0));
        const relation = distance <= 30 ? 'related-nearby' : 'related-same-file';
        results.push({
            file: rel.path, line: rel.line,
            text: rel.signature || rel.name, type: relation, name: rel.name,
        });
    }
}

/** Add similar-name relationships to results */
function addSimilarNameRelationships(
    allSymbols: Array<{ path: string; line: number; name: string; signature: string }>,
    query: string,
    results: FileSearchResult[]
): void {
    const queryLower = query.toLowerCase();
    const similar = allSymbols.filter(item => {
        const lower = item.name.toLowerCase();
        return lower !== queryLower && (lower.includes(queryLower) || queryLower.includes(lower));
    });
    for (const rel of similar) {
        results.push({
            file: rel.path, line: rel.line,
            text: rel.signature || rel.name, type: 'related-similar-name', name: rel.name,
        });
    }
}

/** Deduplicate results by file:line:text */
function deduplicateResults(results: FileSearchResult[], limit: number): FileSearchResult[] {
    const seen = new Set<string>();
    return results.filter(r => {
        const key = `${r.file}: ${r.line}: ${r.text}`;
        if (seen.has(key)) { return false; }
        seen.add(key);
        return true;
    }).slice(0, limit);
}

/** Deduplicate results by file:line:text:type */
function deduplicateResultsWithType(results: FileSearchResult[], limit: number): FileSearchResult[] {
    const seen = new Set<string>();
    return results.filter(item => {
        const key = `${item.file}:${item.line}:${item.text}:${item.type}`;
        if (seen.has(key)) { return false; }
        seen.add(key);
        return true;
    }).slice(0, limit);
}
