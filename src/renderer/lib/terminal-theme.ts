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

import { resolveCssColorVariable } from '@/lib/theme-css';

/**
 * Unified Terminal Theme
 * Uses CSS variables for consistent look across different themes
 */
const TERMINAL_THEME_FALLBACKS: ITheme = {
    background: 'transparent',
    foreground: 'hsl(215 32% 88%)',
    cursor: 'hsl(217 91% 72%)',
    cursorAccent: 'hsl(222 27% 8%)',
    selectionBackground: 'hsl(217 91% 72% / 0.3)',
    selectionForeground: 'hsl(215 32% 88%)',
    black: 'hsl(220 18% 15%)',
    red: 'hsl(355 69% 66%)',
    green: 'hsl(95 42% 62%)',
    yellow: 'hsl(39 66% 69%)',
    blue: 'hsl(207 82% 66%)',
    magenta: 'hsl(280 57% 63%)',
    cyan: 'hsl(186 45% 56%)',
    white: 'hsl(218 15% 71%)',
    brightBlack: 'hsl(221 10% 41%)',
    brightRed: 'hsl(355 69% 66%)',
    brightGreen: 'hsl(95 42% 62%)',
    brightYellow: 'hsl(39 66% 69%)',
    brightBlue: 'hsl(207 82% 66%)',
    brightMagenta: 'hsl(280 57% 63%)',
    brightCyan: 'hsl(186 45% 56%)',
    brightWhite: 'hsl(0 0% 100%)',
};

export const getTerminalTheme = (): ITheme => {
    return {
        ...TERMINAL_THEME_FALLBACKS,
        background: 'transparent', // Let the container handle surface opacity/blur.
        foreground: resolveCssColorVariable(
            'terminal-foreground',
            TERMINAL_THEME_FALLBACKS.foreground ?? 'hsl(215 32% 88%)'
        ),
        cursor: resolveCssColorVariable(
            'terminal-cursor',
            TERMINAL_THEME_FALLBACKS.cursor ?? 'hsl(217 91% 72%)'
        ),
        cursorAccent: resolveCssColorVariable(
            'terminal-cursor-accent',
            TERMINAL_THEME_FALLBACKS.cursorAccent ?? 'hsl(222 27% 8%)'
        ),
        selectionBackground: resolveCssColorVariable(
            'terminal-selection-background',
            TERMINAL_THEME_FALLBACKS.selectionBackground ?? 'hsl(217 91% 72% / 0.3)'
        ),
        selectionForeground: resolveCssColorVariable(
            'terminal-selection-foreground',
            TERMINAL_THEME_FALLBACKS.selectionForeground ?? 'hsl(215 32% 88%)'
        ),
        black: resolveCssColorVariable(
            'terminal-ansi-black',
            TERMINAL_THEME_FALLBACKS.black ?? 'hsl(220 18% 15%)'
        ),
        red: resolveCssColorVariable(
            'terminal-ansi-red',
            TERMINAL_THEME_FALLBACKS.red ?? 'hsl(355 69% 66%)'
        ),
        green: resolveCssColorVariable(
            'terminal-ansi-green',
            TERMINAL_THEME_FALLBACKS.green ?? 'hsl(95 42% 62%)'
        ),
        yellow: resolveCssColorVariable(
            'terminal-ansi-yellow',
            TERMINAL_THEME_FALLBACKS.yellow ?? 'hsl(39 66% 69%)'
        ),
        blue: resolveCssColorVariable(
            'terminal-ansi-blue',
            TERMINAL_THEME_FALLBACKS.blue ?? 'hsl(207 82% 66%)'
        ),
        magenta: resolveCssColorVariable(
            'terminal-ansi-magenta',
            TERMINAL_THEME_FALLBACKS.magenta ?? 'hsl(280 57% 63%)'
        ),
        cyan: resolveCssColorVariable(
            'terminal-ansi-cyan',
            TERMINAL_THEME_FALLBACKS.cyan ?? 'hsl(186 45% 56%)'
        ),
        white: resolveCssColorVariable(
            'terminal-ansi-white',
            TERMINAL_THEME_FALLBACKS.white ?? 'hsl(218 15% 71%)'
        ),
        brightBlack: resolveCssColorVariable(
            'terminal-ansi-bright-black',
            TERMINAL_THEME_FALLBACKS.brightBlack ?? 'hsl(221 10% 41%)'
        ),
        brightRed: resolveCssColorVariable(
            'terminal-ansi-bright-red',
            TERMINAL_THEME_FALLBACKS.brightRed ?? 'hsl(355 69% 66%)'
        ),
        brightGreen: resolveCssColorVariable(
            'terminal-ansi-bright-green',
            TERMINAL_THEME_FALLBACKS.brightGreen ?? 'hsl(95 42% 62%)'
        ),
        brightYellow: resolveCssColorVariable(
            'terminal-ansi-bright-yellow',
            TERMINAL_THEME_FALLBACKS.brightYellow ?? 'hsl(39 66% 69%)'
        ),
        brightBlue: resolveCssColorVariable(
            'terminal-ansi-bright-blue',
            TERMINAL_THEME_FALLBACKS.brightBlue ?? 'hsl(207 82% 66%)'
        ),
        brightMagenta: resolveCssColorVariable(
            'terminal-ansi-bright-magenta',
            TERMINAL_THEME_FALLBACKS.brightMagenta ?? 'hsl(280 57% 63%)'
        ),
        brightCyan: resolveCssColorVariable(
            'terminal-ansi-bright-cyan',
            TERMINAL_THEME_FALLBACKS.brightCyan ?? 'hsl(186 45% 56%)'
        ),
        brightWhite: resolveCssColorVariable(
            'terminal-ansi-bright-white',
            TERMINAL_THEME_FALLBACKS.brightWhite ?? 'hsl(0 0% 100%)'
        ),
    };
};
