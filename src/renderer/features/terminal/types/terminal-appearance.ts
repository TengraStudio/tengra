import type { ITheme } from '@xterm/xterm';

export type TerminalCursorStyle = 'block' | 'underline' | 'bar';

export type TerminalAppearancePreferences = {
    themePresetId: string;
    fontPresetId: string;
    ligatures: boolean;
    surfaceOpacity: number;
    surfaceBlur: number;
    cursorStyle: TerminalCursorStyle;
    cursorBlink: boolean;
    fontSize: number;
    lineHeight: number;
    customTheme: Partial<ITheme> | null;
};

export type ResolvedTerminalAppearance = {
    theme: ITheme;
    fontFamily: string;
    cursorStyle: TerminalCursorStyle;
    cursorBlink: boolean;
    fontSize: number;
    lineHeight: number;
};

