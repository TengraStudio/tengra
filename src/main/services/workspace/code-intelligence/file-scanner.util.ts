/**
 * File system scanning utilities for code intelligence
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

const CODE_FILE_PATTERN = /\.(ts|tsx|js|jsx|py|go|rs|java|c|cpp|h|hpp|md|txt|json)$/;
const TODO_FILE_PATTERN = /\.(ts|js|py|kt|java|go|rs|cpp|h|gradle)$/;
const SYMBOL_SCAN_PATTERN = /\.(ts|tsx|js|jsx|py|kt|java|go|rs|cpp|h|cs)$/;
const BINARY_FILE_PATTERN = /\.(png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|mp4|webm)$/i;

async function resolveIgnoreMatcher(
    rootPath: string,
    matcher?: WorkspaceIgnoreMatcher
): Promise<WorkspaceIgnoreMatcher> {
    if (matcher) {
        return matcher;
    }
    return getWorkspaceIgnoreMatcher(rootPath, {
        defaultPatterns: DEFAULT_WORKSPACE_SCAN_IGNORE_PATTERNS,
    });
}

/** Recursively scan a directory for code files */
export async function scanDirRecursively(
    dir: string,
    fileList: string[],
    matcher?: WorkspaceIgnoreMatcher
): Promise<void> {
    try {
        const activeMatcher = await resolveIgnoreMatcher(dir, matcher);
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (activeMatcher.ignoresAbsolute(fullPath)) {
                continue;
            }

            if (entry.isDirectory()) {
                await scanDirRecursively(fullPath, fileList, activeMatcher);
            } else if (entry.isFile() && CODE_FILE_PATTERN.test(entry.name)) {
                fileList.push(fullPath);
            }
        }
    } catch (error) {
        appLogger.error('FileScanner', `Failed to scan dir ${dir}`, error as Error);
    }
}

/** Scan directory for TODO/FIXME/HACK comments */
export async function scanDirForTodos(
    dir: string,
    results: FileSearchResult[],
    matcher?: WorkspaceIgnoreMatcher
): Promise<void> {
    try {
        const activeMatcher = await resolveIgnoreMatcher(dir, matcher);
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (activeMatcher.ignoresAbsolute(fullPath)) {
                continue;
            }

            if (entry.isDirectory()) {
                await scanDirForTodos(fullPath, results, activeMatcher);
            } else if (entry.isFile() && TODO_FILE_PATTERN.test(entry.name)) {
                await scanFileForTodos(fullPath, results);
            }
        }
    } catch (error) {
        appLogger.error('FileScanner', `Failed to scan todos in ${dir}`, error as Error);
    }
}

/** Scan a single file for TODO-like comments */
async function scanFileForTodos(filePath: string, results: FileSearchResult[]): Promise<void> {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    const todoRegex = /(:?\/\/|#)\s*(TODO|FIXME|BUG|HACK|NOTE|XXX)\b\s*:?(.*)/i;

    lines.forEach((line, index) => {
        const match = line.match(todoRegex);
        if (match) {
            results.push({
                file: filePath,
                line: index + 1,
                text: match[3].trim() || line.trim(),
                type: match[2].toUpperCase()
            });
        }
    });
}

/** Scan directory for symbol definitions matching a query */
export async function scanDirForSymbols(
    dir: string,
    query: string,
    results: FileSearchResult[],
    matcher?: WorkspaceIgnoreMatcher
): Promise<void> {
    try {
        const activeMatcher = await resolveIgnoreMatcher(dir, matcher);
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (activeMatcher.ignoresAbsolute(fullPath)) {
                continue;
            }

            if (entry.isDirectory()) {
                await scanDirForSymbols(fullPath, query, results, activeMatcher);
            } else if (entry.isFile() && SYMBOL_SCAN_PATTERN.test(entry.name)) {
                await scanFileForSymbols(fullPath, query, results);
            }
        }
    } catch (error) {
        appLogger.error('FileScanner', `Failed to scan symbols in ${dir}`, error as Error);
    }
}

/** Scan a single file for symbol definitions */
async function scanFileForSymbols(
    filePath: string,
    query: string,
    results: FileSearchResult[]
): Promise<void> {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    const symbolRegex = new RegExp(
        `(function|class|const|let|var|interface|type|fun|object|interface|void|public|private|protected|internal)\\s+(${query}\\w*)`,
        'i'
    );

    lines.forEach((line, index) => {
        const match = line.match(symbolRegex);
        if (match?.[1] && match[2]) {
            results.push({
                file: filePath,
                line: index + 1,
                text: line.trim(),
                type: match[1],
                name: match[2]
            });
        }
    });
}

/** Scan directory for text/regex matches */
export async function scanDirForText(
    dir: string,
    query: string,
    isRegex: boolean,
    results: FileSearchResult[],
    matcher?: WorkspaceIgnoreMatcher
): Promise<void> {
    try {
        const activeMatcher = await resolveIgnoreMatcher(dir, matcher);
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (activeMatcher.ignoresAbsolute(fullPath)) {
                continue;
            }

            if (entry.isDirectory()) {
                await scanDirForText(fullPath, query, isRegex, results, activeMatcher);
            } else if (entry.isFile() && !BINARY_FILE_PATTERN.test(entry.name)) {
                await scanFileForText(fullPath, query, isRegex, results);
            }
        }
    } catch (error) {
        appLogger.error('FileScanner', `Failed to scan text in ${dir}`, error as Error);
    }
}

/** Scan a single file for text matches */
async function scanFileForText(
    filePath: string,
    query: string,
    isRegex: boolean,
    results: FileSearchResult[]
): Promise<void> {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
        if (results.length >= 1000) { return; }
        let matched = false;

        if (isRegex) {
            try {
                if (new RegExp(query, 'i').test(line)) { matched = true; }
            } catch { /* ignore invalid regex */ }
        } else {
            if (line.toLowerCase().includes(query.toLowerCase())) { matched = true; }
        }

        if (matched) {
            results.push({
                file: filePath,
                line: index + 1,
                text: line.trim().substring(0, 200)
            });
        }
    });
}
