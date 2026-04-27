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
    resolveCssColorVariable,
    resolveCssVariableStyle,
    resolveCssVariableValue,
} from '@/lib/theme-css';
import type { TerminalTab } from '@/types';

import type { TerminalAppearancePreferences } from '../types/terminal-appearance';

import type { RemoteDockerContainer, RemoteSshProfile } from './terminal-panel-types';
import { quoteCommandValue } from './terminal-panel-utils';

export function buildFormattedClipboardHtml(selectedText: string): string {
    const escaped = selectedText
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    const fontFamily = resolveCssVariableStyle(
        'fontFamily',
        'font-family',
        "'Segoe UI Variable', 'Segoe UI', system-ui, sans-serif"
    );
    const fontSize = resolveCssVariableValue('text-sm', '13px');
    const background = resolveCssColorVariable('terminal-preview-background', 'hsl(222 27% 12%)');
    const foreground = resolveCssColorVariable('terminal-preview-foreground', 'hsl(215 32% 88%)');
    const padding = resolveCssVariableStyle('padding', 'tengra-space-2', '8px');
    const borderRadius = resolveCssVariableStyle('borderRadius', 'tengra-radius-md', '4px');

    return `<pre style="font-family: ${fontFamily}; font-size: ${fontSize}; background: ${background}; color: ${foreground}; padding: ${padding}; border-radius: ${borderRadius}; overflow-x: auto;">${escaped}</pre>`;
}

export function summarizePasteText(
    text: string,
    hasAnsi: boolean,
    t: (key: string, options?: Record<string, string | number>) => string
): string {
    const lineCount = text.split(/\r?\n/).length;
    const charCount = text.length;
    const hasSpecialChars = Array.from(text).some(c => {
        const code = c.charCodeAt(0);
        return (code >= 0 && code <= 31) || code === 127;
    });
    const preview = text.slice(0, 500);

    return [
        t('terminal.pasteTestResults'),
        t('terminal.pasteTestLineCount', { count: lineCount }),
        t('terminal.pasteTestCharacterCount', { count: charCount }),
        t('terminal.pasteTestSpecialCharacters', {
            value: hasSpecialChars ? t('common.yes') : t('common.no')
        }),
        t('terminal.pasteTestAnsiCodes', { value: hasAnsi ? t('common.yes') : t('common.no') }),
        '',
        t('common.preview') + ':',
        preview + (text.length > 500 ? t('common.ellipsis') : ''),
    ].join('\n');
}

export function buildSshBootstrapCommand(profile: RemoteSshProfile): string {
    const commandParts: string[] = ['ssh'];
    if (profile.privateKey) {
        commandParts.push('-i', quoteCommandValue(profile.privateKey));
    }
    if (profile.jumpHost) {
        commandParts.push('-J', quoteCommandValue(profile.jumpHost));
    }
    if (profile.port > 0) {
        commandParts.push('-p', String(profile.port));
    }
    commandParts.push(`${profile.username}@${profile.host}`);
    return commandParts.join(' ');
}

export function buildDockerBootstrapCommand(container: RemoteDockerContainer): string {
    return [
        'docker exec -it',
        quoteCommandValue(container.id),
        quoteCommandValue(container.shell || '/bin/sh'),
    ].join(' ');
}

export function validateTerminalAppearanceImport(data: RendererDataValue): {
    valid: boolean;
    errors: string[];
} {
    const errors: string[] = [];
    if (!data || typeof data !== 'object') {
        return { valid: false, errors: ['terminal.importThemeValidation.invalidJsonObject'] };
    }

    const theme = data as Partial<TerminalAppearancePreferences> & Record<string, RendererDataValue>;
    if ('themePresetId' in theme && typeof theme.themePresetId !== 'string') {
        errors.push('terminal.importThemeValidation.themePresetIdString');
    }
    if ('fontPresetId' in theme && typeof theme.fontPresetId !== 'string') {
        errors.push('terminal.importThemeValidation.fontPresetIdString');
    }
    if ('ligatures' in theme && typeof theme.ligatures !== 'boolean') {
        errors.push('terminal.importThemeValidation.ligaturesBoolean');
    }
    if ('surfaceOpacity' in theme) {
        if (typeof theme.surfaceOpacity !== 'number' || theme.surfaceOpacity < 0.6 || theme.surfaceOpacity > 1) {
            errors.push('terminal.importThemeValidation.surfaceOpacityRange');
        }
    }
    if ('surfaceBlur' in theme) {
        if (typeof theme.surfaceBlur !== 'number' || theme.surfaceBlur < 0 || theme.surfaceBlur > 24) {
            errors.push('terminal.importThemeValidation.surfaceBlurRange');
        }
    }
    if ('cursorStyle' in theme) {
        if (!['block', 'underline', 'bar'].includes(theme.cursorStyle as string)) {
            errors.push('terminal.importThemeValidation.cursorStyleAllowedValues');
        }
    }
    if ('cursorBlink' in theme && typeof theme.cursorBlink !== 'boolean') {
        errors.push('terminal.importThemeValidation.cursorBlinkBoolean');
    }
    if ('fontSize' in theme) {
        if (typeof theme.fontSize !== 'number' || theme.fontSize < 8 || theme.fontSize > 32) {
            errors.push('terminal.importThemeValidation.fontSizeRange');
        }
    }
    if ('lineHeight' in theme) {
        if (typeof theme.lineHeight !== 'number' || theme.lineHeight < 1 || theme.lineHeight > 2) {
            errors.push('terminal.importThemeValidation.lineHeightRange');
        }
    }
    if ('customTheme' in theme && theme.customTheme !== null) {
        if (typeof theme.customTheme !== 'object') {
            errors.push('terminal.importThemeValidation.customThemeObjectOrNull');
        } else {
            const customTheme = theme.customTheme as Record<string, RendererDataValue>;
            const validColorKeys = [
                'background', 'foreground', 'cursor', 'cursorAccent', 'selectionBackground',
                'selectionForeground', 'selectionInactiveBackground', 'black', 'red', 'green',
                'yellow', 'blue', 'magenta', 'cyan', 'white', 'brightBlack', 'brightRed',
                'brightGreen', 'brightYellow', 'brightBlue', 'brightMagenta', 'brightCyan', 'brightWhite',
            ];
            for (const key of Object.keys(customTheme)) {
                if (!validColorKeys.includes(key)) {
                    errors.push('terminal.importThemeValidation.customThemeUnknownProperty');
                } else if (typeof customTheme[key] !== 'string') {
                    errors.push('terminal.importThemeValidation.customThemeColorString');
                }
            }
        }
    }

    return { valid: errors.length === 0, errors };
}

export function resolveSecondarySplitTabId(
    tabs: TerminalTab[],
    activeId: string
): string | undefined {
    return tabs.find(tab => tab.id !== activeId)?.id;
}
