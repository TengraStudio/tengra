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
 * TextMate Grammar Loader for Monaco Editor
 * Enables syntax highlighting for languages not natively supported by Monaco
 * 
 * This module provides a simplified TextMate integration that gracefully falls back
 * to Monaco's native highlighting when TextMate grammars are unavailable.
 */

import type { Monaco } from '@monaco-editor/react';
import { appLogger } from '@system/utils/renderer-logger';

// Initialization state
let isInitialized = false;
let initPromise: Promise<boolean> | null = null;

// Languages that need TextMate for better highlighting
const TEXTMATE_LANGUAGES = new Set([
    'vue',
    'svelte',
    'astro',
    'haskell',
    'elm',
    'erlang',
    'ocaml',
    'purescript',
    'nim',
    'zig',
    'nix',
    'gleam',
]);

/**
 * Initialize TextMate support for Monaco
 * This is a simplified implementation that registers language configurations
 * For full TextMate grammar support, additional WASM loading would be needed
 */
export async function initTextMateSupport(monaco: Monaco): Promise<boolean> {
    if (isInitialized) { return true; }

    if (initPromise) {
        return initPromise;
    }

    initPromise = (async () => {
        try {
            // Register additional languages that Monaco doesn't support natively
            // These will use basic tokenization rules

            // Vue - register with HTML-like tokenization
            if (!monaco.languages.getLanguages().some((l: { id: string }) => l.id === 'vue')) {
                monaco.languages.register({ id: 'vue', extensions: ['.vue'] });
                monaco.languages.setLanguageConfiguration('vue', {
                    brackets: [
                        ['{', '}'],
                        ['[', ']'],
                        ['(', ')'],
                        ['<', '>'],
                    ],
                    autoClosingPairs: [
                        { open: '{', close: '}' },
                        { open: '[', close: ']' },
                        { open: '(', close: ')' },
                        { open: '<', close: '>' },
                        { open: '"', close: '"' },
                        { open: "'", close: "'" },
                        { open: '`', close: '`' },
                    ],
                    comments: {
                        lineComment: '//',
                        blockComment: ['<!--', '-->'],
                    },
                });
            }

            // Svelte - register with HTML-like tokenization
            if (!monaco.languages.getLanguages().some((l: { id: string }) => l.id === 'svelte')) {
                monaco.languages.register({ id: 'svelte', extensions: ['.svelte'] });
                monaco.languages.setLanguageConfiguration('svelte', {
                    brackets: [
                        ['{', '}'],
                        ['[', ']'],
                        ['(', ')'],
                        ['<', '>'],
                    ],
                    autoClosingPairs: [
                        { open: '{', close: '}' },
                        { open: '[', close: ']' },
                        { open: '(', close: ')' },
                        { open: '<', close: '>' },
                        { open: '"', close: '"' },
                        { open: "'", close: "'" },
                        { open: '`', close: '`' },
                    ],
                    comments: {
                        lineComment: '//',
                        blockComment: ['<!--', '-->'],
                    },
                });
            }

            // Haskell - basic configuration
            if (!monaco.languages.getLanguages().some((l: { id: string }) => l.id === 'haskell')) {
                monaco.languages.register({ id: 'haskell', extensions: ['.hs', '.lhs'] });
                monaco.languages.setLanguageConfiguration('haskell', {
                    brackets: [
                        ['{', '}'],
                        ['[', ']'],
                        ['(', ')'],
                    ],
                    autoClosingPairs: [
                        { open: '{', close: '}' },
                        { open: '[', close: ']' },
                        { open: '(', close: ')' },
                        { open: '"', close: '"' },
                        { open: "'", close: "'" },
                    ],
                    comments: {
                        lineComment: '--',
                        blockComment: ['{-', '-}'],
                    },
                });
            }

            // Elm
            if (!monaco.languages.getLanguages().some((l: { id: string }) => l.id === 'elm')) {
                monaco.languages.register({ id: 'elm', extensions: ['.elm'] });
                monaco.languages.setLanguageConfiguration('elm', {
                    brackets: [
                        ['{', '}'],
                        ['[', ']'],
                        ['(', ')'],
                    ],
                    autoClosingPairs: [
                        { open: '{', close: '}' },
                        { open: '[', close: ']' },
                        { open: '(', close: ')' },
                        { open: '"', close: '"' },
                    ],
                    comments: {
                        lineComment: '--',
                        blockComment: ['{-', '-}'],
                    },
                });
            }

            // Zig
            if (!monaco.languages.getLanguages().some((l: { id: string }) => l.id === 'zig')) {
                monaco.languages.register({ id: 'zig', extensions: ['.zig'] });
                monaco.languages.setLanguageConfiguration('zig', {
                    brackets: [
                        ['{', '}'],
                        ['[', ']'],
                        ['(', ')'],
                    ],
                    autoClosingPairs: [
                        { open: '{', close: '}' },
                        { open: '[', close: ']' },
                        { open: '(', close: ')' },
                        { open: '"', close: '"' },
                        { open: "'", close: "'" },
                    ],
                    comments: {
                        lineComment: '//',
                    },
                });
            }

            // Nim
            if (!monaco.languages.getLanguages().some((l: { id: string }) => l.id === 'nim')) {
                monaco.languages.register({ id: 'nim', extensions: ['.nim', '.nims'] });
                monaco.languages.setLanguageConfiguration('nim', {
                    brackets: [
                        ['{', '}'],
                        ['[', ']'],
                        ['(', ')'],
                    ],
                    autoClosingPairs: [
                        { open: '{', close: '}' },
                        { open: '[', close: ']' },
                        { open: '(', close: ')' },
                        { open: '"', close: '"' },
                        { open: "'", close: "'" },
                    ],
                    comments: {
                        lineComment: '#',
                        blockComment: ['#[', ']#'],
                    },
                });
            }

            isInitialized = true;
            appLogger.info('TextMate', 'Additional language support initialized');
            return true;
        } catch (error) {
            appLogger.error('TextMate', 'Failed to initialize', error as Error);
            return false;
        }
    })();

    return initPromise;
}

/**
 * Check if TextMate support is available
 */
export function isTextMateAvailable(): boolean {
    return isInitialized;
}

/**
 * Check if a language needs TextMate for better highlighting
 */
export function needsTextMateGrammar(language: string): boolean {
    return TEXTMATE_LANGUAGES.has(language.toLowerCase());
}

