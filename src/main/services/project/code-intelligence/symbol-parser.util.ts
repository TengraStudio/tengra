/**
 * Symbol parsing utilities - extracts code symbols from file content
 */

import * as path from 'path';

import { appLogger } from '@main/logging/logger';

import { CodeSymbol } from './types';

interface SymbolRegex {
    kind: string;
    regex: RegExp;
}

const JS_TS_REGEXES: SymbolRegex[] = [
    { kind: 'function', regex: /(?:export\s+)?(?:async\s+)?function\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)/ },
    { kind: 'class', regex: /(?:export\s+)?class\s+([a-zA-Z0-9_]+)/ },
    { kind: 'interface', regex: /(?:export\s+)?interface\s+([a-zA-Z0-9_]+)/ },
    { kind: 'type', regex: /(?:export\s+)?type\s+([a-zA-Z0-9_]+)\s*=/ },
    { kind: 'variable', regex: /(?:export\s+)?(?:const|let|var)\s+([a-zA-Z0-9_]+)\s*=/ }
];

const PYTHON_REGEXES: SymbolRegex[] = [
    { kind: 'function', regex: /def\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)/ },
    { kind: 'class', regex: /class\s+([a-zA-Z0-9_]+)/ }
];

const GO_REGEXES: SymbolRegex[] = [
    { kind: 'function', regex: /func\s+([a-zA-Z0-9_]+)\s*\(/ },
    { kind: 'type', regex: /type\s+([a-zA-Z0-9_]+)\s+struct/ }
];

/** Get regex patterns for a given file extension */
export function getRegexesForExtension(ext: string): SymbolRegex[] {
    if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) { return JS_TS_REGEXES; }
    if (ext === '.py') { return PYTHON_REGEXES; }
    if (ext === '.go') { return GO_REGEXES; }
    return [];
}

/** Create a CodeSymbol from a regex match */
function createSymbolFromMatch(
    match: RegExpMatchArray,
    filePath: string,
    lineIndex: number,
    lines: string[],
    kind: string
): CodeSymbol {
    const name = match[1];
    const signature = match[0];
    let docstring = '';
    const prevLine = lineIndex > 0 ? lines[lineIndex - 1]?.trim() : null;

    if (prevLine && (prevLine.startsWith('//') || prevLine.startsWith('#') || prevLine.endsWith('*/'))) {
        docstring = prevLine
            .replace(/^\/\/\s*/, '')
            .replace(/^#\s*/, '')
            .replace(/\*\/$/, '')
            .replace(/^\/\*\*\s*/, '');
    }

    return { file: filePath, line: lineIndex + 1, name, kind, signature, docstring };
}

/** Parse all symbols from a file's content */
export function parseFileSymbols(filePath: string, content: string): CodeSymbol[] {
    const results: CodeSymbol[] = [];
    try {
        const ext = path.extname(filePath);
        const regexes = getRegexesForExtension(ext);
        if (regexes.length === 0) { return []; }

        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i]?.trim();
            if (!line) { continue; }

            for (const { kind, regex } of regexes) {
                const match = line.match(regex);
                if (match?.[1]) {
                    results.push(createSymbolFromMatch(match, filePath, i, lines, kind));
                }
            }
        }
    } catch (error) {
        appLogger.error('SymbolParser', `Failed to parse file ${filePath}`, error as Error);
    }
    return results;
}
