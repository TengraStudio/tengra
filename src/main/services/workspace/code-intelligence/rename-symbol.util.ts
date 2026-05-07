/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * Symbol rename utilities
 */

import { promises as fs } from 'fs';

import { getErrorMessage } from '@shared/utils/error.util';

import { scanDirRecursively } from './file-scanner.util';
import { RenameFileChange, RenameLineChange, RenameSymbolResult } from './types';

const CODE_FILE_PATTERN = /\.(ts|tsx|js|jsx|py|go|rs|java|kt|kts|cpp|c|h|hpp|cs)$/i;

/** Validate that a string is a valid identifier */
export function isValidIdentifier(value: string): boolean {
    return /^[A-Za-z_][A-Za-z0-9_]*$/.test(value);
}

/** Scan a single file for rename occurrences */
async function processFileForRename(
    filePath: string,
    pattern: RegExp,
    trimmedNewSymbol: string,
    apply: boolean
): Promise<{ change: RenameFileChange | null; occurrences: number; error: string | null }> {
    const content = await fs.readFile(filePath, 'utf-8');
    const lineEnding = content.includes('\r\n') ? '\r\n' : '\n';
    const lines = content.split(/\r?\n/);
    const replacements: RenameLineChange[] = [];
    let fileChanged = false;
    let occurrences = 0;

    for (let index = 0; index < lines.length; index++) {
        const originalLine = lines[index] ?? '';
        const matches = [...originalLine.matchAll(pattern)];
        if (matches.length === 0) { continue; }

        const nextLine = originalLine.replace(pattern, trimmedNewSymbol);
        lines[index] = nextLine;
        occurrences += matches.length;
        fileChanged = true;
        replacements.push({
            line: index + 1,
            occurrences: matches.length,
            before: originalLine,
            after: nextLine,
        });
    }

    if (!fileChanged) {
        return { change: null, occurrences: 0, error: null };
    }

    if (apply) {
        await fs.writeFile(filePath, lines.join(lineEnding), 'utf-8');
    }

    return {
        change: { file: filePath, replacements },
        occurrences,
        error: null,
    };
}

/** Rename a symbol across a workspace */
export async function renameSymbol(
    rootPath: string,
    symbol: string,
    newSymbol: string,
    apply: boolean = false,
    maxFiles: number = 500
): Promise<RenameSymbolResult> {
    const trimmedSymbol = symbol.trim();
    const trimmedNewSymbol = newSymbol.trim();
    const safeMaxFiles = Number.isFinite(maxFiles) && maxFiles > 0
        ? Math.min(Math.trunc(maxFiles), 5000)
        : 500;

    if (!isValidIdentifier(trimmedSymbol) || !isValidIdentifier(trimmedNewSymbol)) {
        return {
            success: false, applied: apply, symbol: trimmedSymbol, newSymbol: trimmedNewSymbol,
            totalFiles: 0, totalOccurrences: 0, changes: [], updatedFiles: [],
            errors: [{ file: '', error: 'Invalid identifier payload for rename operation' }],
        };
    }

    const files: string[] = [];
    await scanDirRecursively(rootPath, files);
    const candidateFiles = files.filter(f => CODE_FILE_PATTERN.test(f)).slice(0, safeMaxFiles);

    const escapedSymbol = trimmedSymbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`\\b${escapedSymbol}\\b`, 'g');
    const changes: RenameFileChange[] = [];
    const updatedFiles: string[] = [];
    const errors: Array<{ file: string; error: string }> = [];
    let totalOccurrences = 0;

    for (const filePath of candidateFiles) {
        try {
            const result = await processFileForRename(filePath, pattern, trimmedNewSymbol, apply);
            if (result.change) {
                changes.push(result.change);
                totalOccurrences += result.occurrences;
                if (apply) { updatedFiles.push(filePath); }
            }
        } catch (error) {
            errors.push({ file: filePath, error: getErrorMessage(error as Error) });
        }
    }

    return {
        success: errors.length === 0,
        applied: apply,
        symbol: trimmedSymbol,
        newSymbol: trimmedNewSymbol,
        totalFiles: changes.length,
        totalOccurrences,
        changes,
        updatedFiles,
        errors,
    };
}

