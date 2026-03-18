import type { TerminalTab } from '@/types';

import type { TerminalAppearancePreferences } from '../types/terminal-appearance';

import type { RemoteDockerContainer, RemoteSshProfile } from './terminal-panel-types';
import { quoteCommandValue } from './terminal-panel-utils';

export function buildFormattedClipboardHtml(selectedText: string): string {
    const escaped = selectedText
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    return `<pre style="font-family: 'JetBrains Mono', 'Fira Code', Consolas, monospace; font-size: 13px; background: #1e1e1e; color: #d4d4d4; padding: 8px; border-radius: 4px; overflow-x: auto;">${escaped}</pre>`;
}

export function summarizePasteText(text: string, hasAnsi: boolean): string {
    const lineCount = text.split(/\r?\n/).length;
    const charCount = text.length;
    const hasSpecialChars = Array.from(text).some(c => {
        const code = c.charCodeAt(0);
        return (code >= 0 && code <= 31) || code === 127;
    });
    const preview = text.slice(0, 500);

    return [
        `Paste Test Results:`,
        `• ${lineCount} line(s)`,
        `• ${charCount} character(s)`,
        `• Special characters: ${hasSpecialChars ? 'Yes' : 'No'}`,
        `• ANSI codes: ${hasAnsi ? 'Yes' : 'No'}`,
        '',
        'Preview:',
        preview + (text.length > 500 ? '...' : ''),
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
        return { valid: false, errors: ['Invalid theme file: must be a JSON object'] };
    }

    const theme = data as Partial<TerminalAppearancePreferences> & Record<string, RendererDataValue>;
    if ('themePresetId' in theme && typeof theme.themePresetId !== 'string') {
        errors.push('themePresetId must be a string');
    }
    if ('fontPresetId' in theme && typeof theme.fontPresetId !== 'string') {
        errors.push('fontPresetId must be a string');
    }
    if ('ligatures' in theme && typeof theme.ligatures !== 'boolean') {
        errors.push('ligatures must be a boolean');
    }
    if ('surfaceOpacity' in theme) {
        if (typeof theme.surfaceOpacity !== 'number' || theme.surfaceOpacity < 0.6 || theme.surfaceOpacity > 1) {
            errors.push('surfaceOpacity must be a number between 0.6 and 1');
        }
    }
    if ('surfaceBlur' in theme) {
        if (typeof theme.surfaceBlur !== 'number' || theme.surfaceBlur < 0 || theme.surfaceBlur > 24) {
            errors.push('surfaceBlur must be a number between 0 and 24');
        }
    }
    if ('cursorStyle' in theme) {
        if (!['block', 'underline', 'bar'].includes(theme.cursorStyle as string)) {
            errors.push('cursorStyle must be one of: block, underline, bar');
        }
    }
    if ('cursorBlink' in theme && typeof theme.cursorBlink !== 'boolean') {
        errors.push('cursorBlink must be a boolean');
    }
    if ('fontSize' in theme) {
        if (typeof theme.fontSize !== 'number' || theme.fontSize < 8 || theme.fontSize > 32) {
            errors.push('fontSize must be a number between 8 and 32');
        }
    }
    if ('lineHeight' in theme) {
        if (typeof theme.lineHeight !== 'number' || theme.lineHeight < 1 || theme.lineHeight > 2) {
            errors.push('lineHeight must be a number between 1 and 2');
        }
    }
    if ('customTheme' in theme && theme.customTheme !== null) {
        if (typeof theme.customTheme !== 'object') {
            errors.push('customTheme must be an object or null');
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
                    errors.push(`customTheme has unknown property: ${key}`);
                } else if (typeof customTheme[key] !== 'string') {
                    errors.push(`customTheme.${key} must be a string (color value)`);
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
