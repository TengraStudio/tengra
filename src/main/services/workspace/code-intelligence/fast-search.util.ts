/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { promises as fs } from 'fs';
import * as path from 'path';

import { appLogger } from '@main/logging/logger';
import {
    DEFAULT_WORKSPACE_SCAN_IGNORE_PATTERNS,
    getWorkspaceIgnoreMatcher,
    WorkspaceIgnoreMatcher,
} from '@main/services/workspace/workspace-ignore.util';
import { FileSearchResult } from '@shared/types/common';

/** Maximum concurrent file reads */
const CONCURRENCY = 64;

/** Maximum results to return globally */
const MAX_TOTAL_RESULTS = 5000;

/** Max file size to search (100MB) */
const MAX_FILE_SIZE = 100 * 1024 * 1024;

/** Binary extensions to skip (only the most obvious ones) */
const BINARY_EXTS = new Set([
    '.png', '.jpg', '.jpeg', '.gif', '.ico', '.pdf', '.zip', '.gz', '.tar', 
    '.exe', '.dll', '.bin', '.node', '.wasm', '.mp4', '.mov', '.mp3', '.wav', 
    '.woff', '.woff2', '.ttf'
]);

export interface SearchOptions {
    isRegex?: boolean;
    matchCase?: boolean;
    matchWholeWord?: boolean;
}

export async function fastTextSearch(
    rootPath: string,
    query: string,
    options: SearchOptions = {}
): Promise<FileSearchResult[]> {
    const results: FileSearchResult[] = [];
    await streamTextSearch(rootPath, query, (chunk) => {
        results.push(...chunk);
    }, options);
    return results.slice(0, MAX_TOTAL_RESULTS);
}

/**
 * Streaming version of text search.
 * Yields results in batches to a callback.
 * Supports cancellation via an AbortSignal.
 */
export async function streamTextSearch(
    rootPath: string,
    query: string,
    onResults: (results: FileSearchResult[]) => void,
    options: SearchOptions & {
        includeGlob?: string;
        excludeGlob?: string;
        signal?: AbortSignal;
    } = {}
): Promise<void> {
    const { 
        isRegex = false, 
        matchCase = false, 
        matchWholeWord = false,
        includeGlob,
        excludeGlob,
        signal
    } = options;

    if (!query || typeof query !== 'string' || !query.trim()) {
        return;
    }
    const trimmedQuery = query.trim();

    // Check for early cancellation
    if (signal?.aborted) {
        return;
    }

    // Build the matcher with include/exclude overrides
    let matcher: WorkspaceIgnoreMatcher;
    try {
        matcher = await getWorkspaceIgnoreMatcher(rootPath, {
            defaultPatterns: DEFAULT_WORKSPACE_SCAN_IGNORE_PATTERNS,
            includeGlob,
            excludeGlob
        });
    } catch {
        matcher = await getWorkspaceIgnoreMatcher(rootPath, {
            defaultPatterns: DEFAULT_WORKSPACE_SCAN_IGNORE_PATTERNS,
        });
    }

    const searchRegex = buildSearchRegex(trimmedQuery, { isRegex, matchCase, matchWholeWord });
    if (!searchRegex) {
        return;
    }

    let totalResults = 0;
    let currentBatch: FileSearchResult[] = [];
    const BATCH_SIZE = 50;
    
    // Shared queue for found files
    const fileQueue: string[] = [];
    let queueIndex = 0;
    let discoveryDone = false;
    
    // Start search workers immediately
    const workerCount = CONCURRENCY;
    const workers = Array(workerCount).fill(null).map(async () => {
        let iterations = 0;
        const SAFE_MAX_ITERATIONS = 1_000_000;
        while (iterations < SAFE_MAX_ITERATIONS) {
            iterations++;
            if (signal?.aborted || totalResults >= MAX_TOTAL_RESULTS) {
                break;
            }
            
            if (queueIndex >= fileQueue.length) {
                if (discoveryDone) {
                    break;
                }
                // Wait a bit for discovery to catch up
                await new Promise(r => setTimeout(r, 5));
                continue;
            }

            const filePath = fileQueue[queueIndex++];
            if (!filePath) {
                continue;
            }

            const fileResults = await searchSingleFile(filePath, searchRegex, trimmedQuery);
            if (fileResults.length > 0) {
                currentBatch.push(...fileResults);
                totalResults += fileResults.length;

                // Priority: Send first batch immediately if it's small to show something
                if (totalResults <= 10 || currentBatch.length >= BATCH_SIZE) {
                    onResults([...currentBatch]);
                    currentBatch = [];
                }
            }
        }
    });

    // Start discovery
    try {
        await collectSearchableFiles(rootPath, (filePath) => {
            fileQueue.push(filePath);
        }, matcher, 0, signal);
    } finally {
        discoveryDone = true;
    }

    await Promise.all(workers);

    // Final flush
    if (currentBatch.length > 0 && !signal?.aborted) {
        onResults(currentBatch);
    }
}

/**
 * Fuzzy file name search (equivalent to VS Code "Go to File")
 */
export async function fastFileSearch(
    rootPath: string,
    query: string
): Promise<FileSearchResult[]> {
    const startTime = performance.now();
    if (!query?.trim()) {
        return [];
    }

    let matcher: WorkspaceIgnoreMatcher;
    try {
        matcher = await getWorkspaceIgnoreMatcher(rootPath, {
            defaultPatterns: DEFAULT_WORKSPACE_SCAN_IGNORE_PATTERNS,
        });
    } catch {
        matcher = await getWorkspaceIgnoreMatcher(rootPath, {
            defaultPatterns: DEFAULT_WORKSPACE_SCAN_IGNORE_PATTERNS,
        });
    }

    const filePaths: string[] = [];
    await collectSearchableFiles(rootPath, (fp) => filePaths.push(fp), matcher);

    const results: FileSearchResult[] = [];
    const lowerQuery = query.toLowerCase();

    for (const filePath of filePaths) {
        const fileName = path.basename(filePath).toLowerCase();
        if (fileName.includes(lowerQuery) || fuzzyMatch(fileName, lowerQuery)) {
            results.push({
                file: filePath,
                line: 1,
                text: filePath.replace(rootPath, ''),
                type: 'file'
            });
            if (results.length > 100) {
                break;
            }
        }
    }

    appLogger.info('FastSearch', `File search for "${query}" found ${results.length} files in ${(performance.now() - startTime).toFixed(0)}ms`);
    return results;
}

function buildSearchRegex(query: string, options: SearchOptions): RegExp | null {
    try {
        let pattern = query;
        if (!options.isRegex) {
            // Escape literal
            pattern = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }
        
        if (options.matchWholeWord) {
            pattern = `\\b${pattern}\\b`;
        }

        return new RegExp(pattern, options.matchCase ? 'g' : 'gi');
    } catch (e) {
        appLogger.error('FastSearch', `Invalid regex pattern: ${query}`, e as Error);
        return null;
    }
}

async function collectSearchableFiles(
    dir: string,
    onFile: (filePath: string) => void,
    matcher: WorkspaceIgnoreMatcher,
    depth: number = 0,
    signal?: AbortSignal
): Promise<void> {
    if (depth > 30 || signal?.aborted) {
        return;
    }
    try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        const dirs: string[] = [];
        for (const entry of entries) {
            if (signal?.aborted) {
                return;
            }

            const fullPath = path.join(dir, entry.name);
            if (matcher.ignoresAbsolute(fullPath)) {
                continue;
            }

            if (entry.isDirectory()) {
                dirs.push(fullPath);
            } else if (entry.isFile()) {
                const ext = path.extname(entry.name).toLowerCase();
                if (!BINARY_EXTS.has(ext)) {
                    onFile(fullPath);
                }
            }
        }
        
        // Batch readdir calls to avoid deep recursion overhead
        await Promise.all(dirs.map(d => collectSearchableFiles(d, onFile, matcher, depth + 1, signal)));
    } catch {
        // Skip inaccessible
    }
}

async function searchSingleFile(
    filePath: string,
    regex: RegExp,
    query: string
): Promise<FileSearchResult[]> {
    try {
        const stat = await fs.stat(filePath);
        if (stat.size > MAX_FILE_SIZE || stat.size === 0) {
            return [];
        }

        const buffer = await fs.readFile(filePath);
        
        // Quick rejection: check if file contains query before decoding (only for case-sensitive)
        const queryBuffer = Buffer.from(query, 'utf8');
        if (regex.flags.includes('g') && !regex.flags.includes('i')) {
            if (buffer.indexOf(queryBuffer) === -1) {
                return [];
            }
        }

        const content = buffer.toString('utf8');
        if (!regex.test(content)) {
            return [];
        }

        // Reset regex because test() moves lastIndex
        regex.lastIndex = 0;

        const results: FileSearchResult[] = [];
        const lines = content.split(/\r?\n/);
        const maxPerFile = 100;

        for (let i = 0; i < lines.length && results.length < maxPerFile; i++) {
            const line = lines[i];
            // Test line only if needed
            if (regex.test(line)) {
                results.push({
                    file: filePath,
                    line: i + 1,
                    text: line.trim().substring(0, 300),
                });
            }
            regex.lastIndex = 0;
        }
        return results;
    } catch {
        return [];
    }
}

function fuzzyMatch(text: string, query: string): boolean {
    let qi = 0;
    for (let ti = 0; ti < text.length && qi < query.length; ti++) {
        if (text[ti] === query[qi]) {
            qi++;
        }
    }
    return qi === query.length;
}
