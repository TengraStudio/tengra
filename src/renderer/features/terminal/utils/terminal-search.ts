/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export type TerminalSearchMatch = {
    row: number;
    col: number;
    length: number;
};

export type TerminalSearchOptions = {
    useRegex: boolean;
    caseSensitive?: boolean;
    maxMatches?: number;
};

export type TerminalSearchCollectResult = {
    matches: TerminalSearchMatch[];
    invalidRegex: boolean;
};

function collectPlainMatches(
    line: string,
    query: string,
    caseSensitive: boolean
): Array<{ col: number; length: number }> {
    const source = caseSensitive ? line : line.toLowerCase();
    const needle = caseSensitive ? query : query.toLowerCase();
    const matches: Array<{ col: number; length: number }> = [];
    if (!needle) {
        return matches;
    }
    let start = 0;
    while (start <= source.length) {
        const index = source.indexOf(needle, start);
        if (index < 0) {
            break;
        }
        matches.push({ col: index, length: Math.max(needle.length, 1) });
        start = index + Math.max(needle.length, 1);
    }
    return matches;
}

function collectRegexMatches(line: string, regex: RegExp): Array<{ col: number; length: number }> {
    const matches: Array<{ col: number; length: number }> = [];
    for (let match = regex.exec(line); match; match = regex.exec(line)) {
        const text = match[0] ?? '';
        matches.push({ col: match.index, length: Math.max(text.length, 1) });
        if (regex.lastIndex === match.index) {
            regex.lastIndex += 1;
        }
    }
    return matches;
}

export function collectTerminalSearchMatches(
    lines: string[],
    query: string,
    options: TerminalSearchOptions
): TerminalSearchCollectResult {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
        return { matches: [], invalidRegex: false };
    }

    const maxMatches = options.maxMatches ?? 300;
    const caseSensitive = options.caseSensitive ?? false;
    const rows: TerminalSearchMatch[] = [];

    let regex: RegExp | null = null;
    if (options.useRegex) {
        try {
            regex = new RegExp(trimmedQuery, caseSensitive ? 'g' : 'gi');
        } catch {
            return { matches: [], invalidRegex: true };
        }
    }

    for (let row = 0; row < lines.length; row += 1) {
        const line = lines[row] ?? '';
        if (!line) {
            continue;
        }

        const lineMatches = regex
            ? collectRegexMatches(line, new RegExp(regex.source, regex.flags))
            : collectPlainMatches(line, trimmedQuery, caseSensitive);

        for (const match of lineMatches) {
            rows.push({ row, col: match.col, length: match.length });
            if (rows.length >= maxMatches) {
                return { matches: rows, invalidRegex: false };
            }
        }
    }

    return { matches: rows, invalidRegex: false };
}

