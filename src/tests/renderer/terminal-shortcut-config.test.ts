/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
    createShortcutShareCode,
    isTypingElement,
    keyboardEventToShortcut,
    normalizeShortcutBinding,
    parseShortcutShareCode,
    parseShortcutStorage,
    sanitizeShortcutBindings,
    serializeShortcutStorage,
    TERMINAL_SHORTCUT_PRESETS,
} from '@renderer/features/terminal/utils/shortcut-config';
import { describe, expect, it } from 'vitest';

describe('terminal shortcut config utils', () => {
    it('normalizes shortcut bindings to a canonical format', () => {
        expect(normalizeShortcutBinding(' Ctrl + ` ')).toBe('CTRL+BACKQUOTE');
        expect(normalizeShortcutBinding('ctrl+\\')).toBe('CTRL+BACKSLASH');
        expect(normalizeShortcutBinding('ctrl+/')).toBe('CTRL+SLASH');
    });

    it('converts keyboard events to shortcut strings', () => {
        const event = new KeyboardEvent('keydown', { ctrlKey: true, code: 'KeyF', key: 'f' });
        expect(keyboardEventToShortcut(event)).toBe('CTRL+F');
    });

    it('treats meta key as ctrl equivalent for shortcuts', () => {
        const event = new KeyboardEvent('keydown', {
            metaKey: true,
            shiftKey: true,
            code: 'KeyK',
            key: 'k',
        });
        expect(keyboardEventToShortcut(event)).toBe('CTRL+SHIFT+K');
    });

    it('detects typing elements correctly', () => {
        const input = document.createElement('input');
        const textarea = document.createElement('textarea');
        const contentEditable = document.createElement('div');
        contentEditable.setAttribute('contenteditable', 'true');
        const textboxRole = document.createElement('div');
        textboxRole.setAttribute('role', 'textbox');
        const plainDiv = document.createElement('div');

        expect(isTypingElement(input)).toBe(true);
        expect(isTypingElement(textarea)).toBe(true);
        expect(isTypingElement(contentEditable)).toBe(true);
        expect(isTypingElement(textboxRole)).toBe(true);
        expect(isTypingElement(plainDiv)).toBe(false);
        expect(isTypingElement(null)).toBe(false);
    });

    it('sanitizes shortcut bindings by removing invalid entries', () => {
        const result = sanitizeShortcutBindings({
            search: 'Ctrl+F',
            split: '   ',
            nope: 'Ctrl+X',
            detach: 123,
        });
        expect(result).toEqual({ search: 'Ctrl+F' });
    });

    it('parses shortcut storage payload with preset and bindings', () => {
        const raw = serializeShortcutStorage('vim', {
            ...TERMINAL_SHORTCUT_PRESETS.vim,
            search: 'Ctrl+K',
        });
        const parsed = parseShortcutStorage(raw);

        expect(parsed.preset).toBe('vim');
        expect(parsed.bindings.search).toBe('Ctrl+K');
        expect(parsed.bindings.split).toBe('Ctrl+\\');
    });

    it('returns safe defaults for invalid shortcut storage payload', () => {
        expect(parseShortcutStorage(null)).toEqual({ preset: null, bindings: {} });
        expect(parseShortcutStorage('{invalid json')).toEqual({ preset: null, bindings: {} });
        expect(parseShortcutStorage(JSON.stringify({ preset: 'unknown', bindings: {} }))).toEqual({
            preset: null,
            bindings: {},
        });
    });

    it('round-trips shortcut share codes', () => {
        const shareCode = createShortcutShareCode('emacs', TERMINAL_SHORTCUT_PRESETS.emacs);
        const parsed = parseShortcutShareCode(shareCode);
        expect(parsed.preset).toBe('emacs');
        expect(parsed.bindings.search).toBe('Ctrl+S');
    });

    it('handles invalid shortcut share codes safely', () => {
        expect(parseShortcutShareCode('not-base64')).toEqual({ preset: null, bindings: {} });
    });
});
