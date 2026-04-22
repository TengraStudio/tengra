/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { type ITheme } from '@xterm/xterm';

import type {
    ResolvedTerminalAppearance,
    TerminalAppearancePreferences,
    TerminalCursorStyle,
} from '../types/terminal-appearance';
import { serializeTerminalModuleVersion } from '../utils/module-version';

// ── Storage keys ────────────────────────────────────────────────────────────────

export const TERMINAL_SEARCH_HISTORY_STORAGE_KEY = 'terminal.search-history.v1';
export const TERMINAL_SEARCH_HISTORY_LIMIT = 12;
export const TERMINAL_PREFERRED_BACKEND_STORAGE_KEY = 'terminal.preferred-backend.v1';
export const TERMINAL_APPEARANCE_STORAGE_KEY = 'terminal.appearance.v1';
export const TERMINAL_SHORTCUTS_STORAGE_KEY = 'terminal.shortcuts.v1';
export const TERMINAL_PASTE_HISTORY_STORAGE_KEY = 'terminal.paste-history.v1';
export const TERMINAL_PASTE_HISTORY_LIMIT = 10;
export const TERMINAL_SYNC_INPUT_STORAGE_KEY = 'terminal.sync-input.v1';
export const TERMINAL_SPLIT_PRESETS_STORAGE_KEY = 'terminal.split-presets.v1';
export const TERMINAL_SPLIT_LAYOUT_STORAGE_KEY = 'terminal.split-layout.v1';
export const TERMINAL_SPLIT_ANALYTICS_STORAGE_KEY = 'terminal.split-analytics.v1';
export const TERMINAL_WORKSPACE_ISSUES_TAB_ID = '__workspace-issues-tab__';
export const TERMINAL_MANAGER_MODULE_VERSION = serializeTerminalModuleVersion();

// ── Regex ───────────────────────────────────────────────────────────────────────

export const ANSI_ESCAPE_SEQUENCE_REGEX = new RegExp(
    String.raw`\x1B(?:\[[0-?]*[ -/]*[@-~]|[@-Z\\-_]|\][^\x07]*(?:\x07|\x1B\\))`,
    'g'
);

// ── Types ───────────────────────────────────────────────────────────────────────

export type RemoteConnectionTarget =
    | {
          kind: 'ssh';
          profile: import('../utils/terminal-panel-types').RemoteSshProfile;
      }
    | {
          kind: 'docker';
          container: import('../utils/terminal-panel-types').RemoteDockerContainer;
      };

export type TerminalAppearancePreset = {
    id: string;
    name: string;
    category: 'default' | 'community';
    theme: Partial<ITheme>;
};

export type TerminalFontPreset = {
    id: string;
    name: string;
    fontFamily: string;
};

// ── Theme presets ───────────────────────────────────────────────────────────────

export const TERMINAL_THEME_PRESETS: TerminalAppearancePreset[] = [
    { id: 'system', name: 'System', category: 'default', theme: {} },
    {
        id: 'dracula',
        name: 'Dracula',
        category: 'community',
        theme: {
            background: '#282a36',
            foreground: '#f8f8f2',
            cursor: '#f8f8f2',
            selectionBackground: '#44475a',
            black: '#21222c',
            red: '#ff5555',
            green: '#50fa7b',
            yellow: '#f1fa8c',
            blue: '#bd93f9',
            magenta: '#ff79c6',
            cyan: '#8be9fd',
            white: '#f8f8f2',
            brightBlack: '#6272a4',
            brightRed: '#ff6e6e',
            brightGreen: '#69ff94',
            brightYellow: '#ffffa5',
            brightBlue: '#d6acff',
            brightMagenta: '#ff92df',
            brightCyan: '#a4ffff',
            brightWhite: '#ffffff',
        },
    },
    {
        id: 'gruvbox-dark',
        name: 'Gruvbox Dark',
        category: 'community',
        theme: {
            background: '#282828',
            foreground: '#ebdbb2',
            cursor: '#ebdbb2',
            selectionBackground: '#504945',
            black: '#282828',
            red: '#cc241d',
            green: '#98971a',
            yellow: '#d79921',
            blue: '#458588',
            magenta: '#b16286',
            cyan: '#689d6a',
            white: '#a89984',
            brightBlack: '#928374',
            brightRed: '#fb4934',
            brightGreen: '#b8bb26',
            brightYellow: '#fabd2f',
            brightBlue: '#83a598',
            brightMagenta: '#d3869b',
            brightCyan: '#8ec07c',
            brightWhite: '#ebdbb2',
        },
    },
    {
        id: 'tokyo-night',
        name: 'Tokyo Night',
        category: 'community',
        theme: {
            background: '#1a1b26',
            foreground: '#c0caf5',
            cursor: '#c0caf5',
            selectionBackground: '#33467c',
            black: '#15161e',
            red: '#f7768e',
            green: '#9ece6a',
            yellow: '#e0af68',
            blue: '#7aa2f7',
            magenta: '#bb9af7',
            cyan: '#7dcfff',
            white: '#a9b1d6',
            brightBlack: '#414868',
            brightRed: '#f7768e',
            brightGreen: '#9ece6a',
            brightYellow: '#e0af68',
            brightBlue: '#7aa2f7',
            brightMagenta: '#bb9af7',
            brightCyan: '#7dcfff',
            brightWhite: '#c0caf5',
        },
    },
];

// ── Font presets ────────────────────────────────────────────────────────────────

export const TERMINAL_FONT_PRESETS: TerminalFontPreset[] = [
    {
        id: 'system',
        name: 'Monospace',
        fontFamily: "'Cascadia Mono', Consolas, 'Courier New', monospace",
    },
];

// ── Cursor styles ───────────────────────────────────────────────────────────────

export const TERMINAL_CURSOR_STYLES: { id: TerminalCursorStyle; name: string }[] = [
    { id: 'block', name: 'Block' },
    { id: 'underline', name: 'Underline' },
    { id: 'bar', name: 'Bar' },
];

// ── Default appearance ──────────────────────────────────────────────────────────

export const DEFAULT_TERMINAL_APPEARANCE: TerminalAppearancePreferences = {
    themePresetId: 'system',
    fontPresetId: 'system',
    ligatures: false,
    surfaceOpacity: 0.92,
    surfaceBlur: 14,
    cursorStyle: 'block',
    cursorBlink: true,
    fontSize: 13,
    lineHeight: 1.2,
    customTheme: null,
};

// ── Utility functions ───────────────────────────────────────────────────────────

/** Strip ANSI escape sequences and carriage returns from a string. */
export function stripAnsiControlSequences(value: string): string {
    return value.replace(ANSI_ESCAPE_SEQUENCE_REGEX, '').replace(/\r/g, '');
}

/** Clamp a numeric value between a minimum and maximum. */
export function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

/** Resolve final terminal appearance by merging base theme, preset, and custom overrides. */
export function resolveTerminalAppearance(
    baseTheme: ITheme,
    appearance: TerminalAppearancePreferences
): ResolvedTerminalAppearance {
    const themePreset =
        TERMINAL_THEME_PRESETS.find(item => item.id === appearance.themePresetId) ??
        TERMINAL_THEME_PRESETS[0];
    const fontPreset =
        TERMINAL_FONT_PRESETS.find(item => item.id === DEFAULT_TERMINAL_APPEARANCE.fontPresetId) ??
        TERMINAL_FONT_PRESETS[0];

    const mergedTheme: ITheme = {
        ...baseTheme,
        ...themePreset.theme,
        ...(appearance.customTheme ?? {}),
    };

    return {
        theme: mergedTheme,
        fontFamily: fontPreset.fontFamily,
        cursorStyle: appearance.cursorStyle,
        cursorBlink: appearance.cursorBlink,
        fontSize: appearance.fontSize,
        lineHeight: appearance.lineHeight,
    };
}
