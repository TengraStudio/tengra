/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

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

