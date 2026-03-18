import { type ITheme } from '@xterm/xterm';

/**
 * Unified Terminal Theme
 * Uses CSS variables for consistent look across different themes
 */
const DEFAULT_TERMINAL_THEME: ITheme = {
    background: 'transparent',
    foreground: '#d9e1ec',
    cursor: '#7aa2f7',
    cursorAccent: '#0f1115',
    selectionBackground: 'rgba(122, 162, 247, 0.3)',
    selectionForeground: '#d9e1ec',
    black: '#1f2430',
    red: '#e06c75',
    green: '#98c379',
    yellow: '#e5c07b',
    blue: '#61afef',
    magenta: '#c678dd',
    cyan: '#56b6c2',
    white: '#abb2bf',
    brightBlack: '#5c6370',
    brightRed: '#e06c75',
    brightGreen: '#98c379',
    brightYellow: '#e5c07b',
    brightBlue: '#61afef',
    brightMagenta: '#c678dd',
    brightCyan: '#56b6c2',
    brightWhite: '#ffffff',
};

function getCssVariable(name: string): string | null {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
        return null;
    }
    const value = window.getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value.length > 0 ? value : null;
}

function resolveThemeColorVariable(name: string, fallback: string): string {
    const token = getCssVariable(name);
    if (!token) {
        return fallback;
    }

    // Theme tokens are mostly stored as HSL channels like "222 47% 11%".
    if (/^[-+]?\d/.test(token)) {
        return `hsl(${token})`;
    }

    return token;
}

function resolveThemeColorVariableWithAlpha(name: string, alpha: number, fallback: string): string {
    const token = getCssVariable(name);
    if (!token) {
        return fallback;
    }

    if (/^[-+]?\d/.test(token)) {
        return `hsl(${token} / ${alpha})`;
    }

    return fallback;
}

export const getTerminalTheme = (): ITheme => {
    const fallbackForeground = DEFAULT_TERMINAL_THEME.foreground ?? '#d9e1ec';
    const fallbackCursor = DEFAULT_TERMINAL_THEME.cursor ?? '#7aa2f7';
    const fallbackCursorAccent = DEFAULT_TERMINAL_THEME.cursorAccent ?? '#0f1115';
    const fallbackSelectionBackground =
        DEFAULT_TERMINAL_THEME.selectionBackground ?? 'rgba(122, 162, 247, 0.3)';
    const fallbackSelectionForeground = DEFAULT_TERMINAL_THEME.selectionForeground ?? '#d9e1ec';

    return {
        ...DEFAULT_TERMINAL_THEME,
        background: 'transparent', // Let the container handle surface opacity/blur.
        foreground: resolveThemeColorVariable('--foreground', fallbackForeground),
        cursor: resolveThemeColorVariable('--primary', fallbackCursor),
        cursorAccent: resolveThemeColorVariable('--background', fallbackCursorAccent),
        selectionBackground: resolveThemeColorVariableWithAlpha(
            '--primary',
            0.3,
            fallbackSelectionBackground
        ),
        selectionForeground: resolveThemeColorVariable('--foreground', fallbackSelectionForeground),
    };
};
