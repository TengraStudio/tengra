import { ITheme } from 'xterm';

/**
 * Unified Terminal Theme
 * Uses CSS variables for consistent look across different themes
 */
export const getTerminalTheme = (): ITheme => {
    return {
        background: 'transparent', // Let the container handle background
        foreground: 'hsl(var(--foreground))',
        cursor: 'hsl(var(--primary))',
        cursorAccent: 'hsl(var(--background))',
        selectionBackground: 'hsl(var(--primary) / 0.3)',
        selectionForeground: 'hsl(var(--foreground))',

        // ANSI Colors from CSS variables
        black: 'var(--terminal-black)',
        red: 'var(--terminal-red)',
        green: 'var(--terminal-green)',
        yellow: 'var(--terminal-yellow)',
        blue: 'var(--terminal-blue)',
        magenta: 'var(--terminal-magenta)',
        cyan: 'var(--terminal-cyan)',
        white: 'var(--terminal-white)',

        // Bright variants
        brightBlack: 'var(--terminal-bright-black)',
        brightRed: 'var(--terminal-bright-red)',
        brightGreen: 'var(--terminal-bright-green)',
        brightYellow: 'var(--terminal-bright-yellow)',
        brightBlue: 'var(--terminal-bright-blue)',
        brightMagenta: 'var(--terminal-bright-magenta)',
        brightCyan: 'var(--terminal-bright-cyan)',
        brightWhite: 'var(--terminal-bright-white)',
    };
};
