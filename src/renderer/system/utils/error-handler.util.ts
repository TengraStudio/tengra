/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { JsonValue } from '@shared/types/common';
import { getErrorMessage, getErrorRecoveryStrategy } from '@shared/utils/system/error.util';
import { appLogger } from '@system/utils/renderer-logger';

import { localeRegistry } from '@/i18n/locale-registry.service';
import { enLocalePack } from '@/i18n/locales';

interface CustomWindow extends Window {
    showToast?: (options: { type: string; message: string }) => void
}

const BASE_TRANSLATIONS: JsonValue = enLocalePack.translations;

function getTranslationNode(root: JsonValue | null, path: string): string | null {
    if (root === null) {
        return null;
    }

    const parts = path.split('.');
    let current: JsonValue = root;

    for (const part of parts) {
        if (current !== null && typeof current === 'object' && !Array.isArray(current) && part in current) {
            current = (current as Record<string, JsonValue>)[part];
            continue;
        }
        return null;
    }

    return typeof current === 'string' ? current : null;
}

function interpolateMessage(
    message: string,
    options?: Record<string, string | number>
): string {
    if (!options) {
        return message;
    }

    return Object.keys(options).reduce((accumulator, key) => {
        return accumulator.replace(new RegExp(`{{${key}}}`, 'g'), String(options[key]));
    }, message);
}

function resolveTranslatedMessage(path: string, options?: Record<string, string | number>): string {
    const langCandidate = typeof document === 'undefined'
        ? 'en'
        : localeRegistry.resolveLocale(document.documentElement.lang);
    const activeTranslations = localeRegistry.getTranslations(langCandidate)
        ?? (langCandidate === 'en' ? BASE_TRANSLATIONS : null);
    const activeValue = getTranslationNode(activeTranslations, path);
    if (activeValue === null) {
        return path;
    }
    return interpolateMessage(activeValue, options);
}

const EXACT_ERROR_KEY_MAP: Record<string, string> = {
    CHAT_ID_CREATION_FAILED: 'frontend.errors.chat.idCreationFailed',
    SETTINGS_INVALID_RESPONSE: 'frontend.errors.settings.invalidResponse',
    SETTINGS_INVALID_SAVE_RESPONSE: 'frontend.errors.settings.invalidSaveResponse',
    'Failed to convert file to data URL': 'frontend.errors.attachments.dataUrlConversionFailed',
    'Unknown file read error': 'frontend.errors.attachments.fileReadFailed',
    'Speech recognition not supported': 'frontend.errors.voice.recognitionNotSupported',
    'Runtime status request failed': 'frontend.errors.runtime.statusRequestFailed',
    'Managed runtime repair failed': 'frontend.errors.runtime.repairFailed',
    'Retry operation failed': 'frontend.errors.ssh.retryFailed',
    'Settings operation failed': 'frontend.errors.settings.operationFailed',
    'IPC bridge is not available': 'frontend.errors.ipc.bridgeUnavailable',
    'useWorkspace must be used within a WorkspaceProvider': 'frontend.errors.context.useWorkspaceProvider',
    'useWorkspaceSelection must be used within a WorkspaceProvider': 'frontend.errors.context.useWorkspaceSelectionProvider',
    'useWorkspaceLibrary must be used within a WorkspaceProvider': 'frontend.errors.context.useWorkspaceLibraryProvider',
    'useWorkspaceTerminal must be used within a WorkspaceProvider': 'frontend.errors.context.useWorkspaceTerminalProvider',
    'useTheme must be used within a ThemeProvider': 'frontend.errors.context.useThemeProvider',
    'useSettings must be used within a SettingsProvider': 'frontend.errors.context.useSettingsProvider',
    'useLanguage must be used within a LanguageProvider': 'frontend.errors.context.useLanguageProvider',
    'useModel must be used within a ModelProvider': 'frontend.errors.context.useModelProvider',
    'useAuth must be used within an AuthProvider': 'frontend.errors.context.useAuthProvider',
    'useAuthLanguage must be used within an AuthProvider': 'frontend.errors.context.useAuthLanguageProvider',
    'useAuthSettingsUi must be used within an AuthProvider': 'frontend.errors.context.useAuthSettingsUiProvider',
    'useChat must be used within a ChatProvider': 'frontend.errors.context.useChatProvider',
    'useChatHeader must be used within a ChatProvider': 'frontend.errors.context.useChatHeaderProvider',
    'useChatShell must be used within a ChatProvider': 'frontend.errors.context.useChatShellProvider',
    'useChatLibrary must be used within a ChatProvider': 'frontend.errors.context.useChatLibraryProvider',
    'useChatComposer must be used within a ChatProvider': 'frontend.errors.context.useChatComposerProvider',
    'useChatWindowCommand must be used within a ChatProvider': 'frontend.errors.context.useChatWindowCommandProvider',
    'useChatListening must be used within a ChatProvider': 'frontend.errors.context.useChatListeningProvider',
};

export function translateErrorMessage(message: string): string {
    const normalizedMessage = message.trim();
    if (normalizedMessage === '') {
        return resolveTranslatedMessage('frontend.errors.unexpected');
    }

    if (normalizedMessage.startsWith('frontend.errors.') || normalizedMessage.startsWith('common.')) {
        return resolveTranslatedMessage(normalizedMessage);
    }

    if (normalizedMessage.startsWith('errors.')) {
        return resolveTranslatedMessage('frontend.' + normalizedMessage);
    }

    if (normalizedMessage.startsWith('error.')) {
        return resolveTranslatedMessage(normalizedMessage.replace(/^error\./, 'frontend.errors.'));
    }

    const timeoutMatch = /^(.*?) timed out after (\d+)ms$/i.exec(normalizedMessage);
    if (timeoutMatch) {
        const label = timeoutMatch[1]?.trim() || 'Operation';
        const timeoutMs = Number.parseInt(timeoutMatch[2] ?? '0', 10);
        return resolveTranslatedMessage('frontend.errors.auth.operationTimeout', { label, timeoutMs });
    }

    if (normalizedMessage.startsWith('Incompatible IPC contract:')) {
        return resolveTranslatedMessage('frontend.errors.ipc.contractMismatch');
    }

    const ipcNegotiationMatch = /^IPC contract negotiation failed: (.+)$/.exec(normalizedMessage);
    if (ipcNegotiationMatch) {
        return resolveTranslatedMessage('frontend.errors.ipc.negotiationFailed', {
            reason: ipcNegotiationMatch[1] ?? normalizedMessage,
        });
    }

    const ipcFailureMatch = /^IPC (.+) failed after (\d+) attempt\(s\): (.+)$/.exec(normalizedMessage);
    if (ipcFailureMatch) {
        return resolveTranslatedMessage('frontend.errors.ipc.requestFailedAfterAttempts', {
            channel: ipcFailureMatch[1] ?? 'unknown',
            attempts: ipcFailureMatch[2] ?? '0',
            reason: ipcFailureMatch[3] ?? normalizedMessage,
        });
    }

    const mappedPath = EXACT_ERROR_KEY_MAP[normalizedMessage];
    if (mappedPath) {
        return resolveTranslatedMessage(mappedPath);
    }

    return normalizedMessage;
}

/**
 * Standardized error handling utilities for the renderer process.
 * Provides consistent error handling patterns matching the main process.
 */

export interface ErrorDisplayOptions {
    /**
     * Whether to show a toast notification
     */
    showToast?: boolean
    /**
     * Whether to log to console
     */
    logToConsole?: boolean
    /**
     * Custom error message override
     */
    customMessage?: string
    /**
     * Whether this is a user-facing error
     */
    userFacing?: boolean
    /**
     * Optional callback to react based on standardized recovery strategy.
     */
    onRecoverySuggested?: (strategy: ReturnType<typeof getErrorRecoveryStrategy>) => void
}

/**
 * Maps technical error messages to user-friendly messages
 */
function mapToUserFriendlyMessage(message: string): string {
    const translatedMessage = translateErrorMessage(message);
    if (translatedMessage !== message) {
        return translatedMessage;
    }

    if (message.includes('429') || message.includes('rate limit') || message.includes('quota')) {
        return resolveTranslatedMessage('frontend.errors.rateLimit.exceeded');
    }
    if (message.includes('401') || message.includes('unauthorized')) {
        return resolveTranslatedMessage('frontend.errors.proxy.authFailed');
    }
    if (message.includes('network') || message.includes('fetch')) {
        return resolveTranslatedMessage('common.networkError');
    }
    if (message.includes('timeout')) {
        return resolveTranslatedMessage('frontend.errors.proxy.timeout');
    }
    return message;
}

/**
 * Shows toast notification if available
 */
function showErrorToast(message: string): void {
    if (typeof window === 'undefined') {
        return;
    }
    const customWindow = window as TypeAssertionValue as CustomWindow;
    if (customWindow.showToast) {
        customWindow.showToast({ type: 'error', message });
    }
}

/**
 * Standardized error handler for renderer process.
 * Formats errors consistently and provides user-friendly messages.
 * 
 * @param error - The error to handle
 * @param context - Context where the error occurred (e.g., 'ChatManager', 'SettingsPage')
 * @param options - Additional options for error handling
 * @returns Formatted error message
 * 
 * @example
 * ```typescript
 * try {
 *   await window.electron.db.createChat(chat)
 * } catch (error) {
 *   handleError(error, 'ChatManager', { showToast: true })
 * }
 * ```
 */
/**
 * Gets the error message, with custom message taking precedence
 */
function resolveErrorMessage(error: RendererDataValue, customMessage?: string): string {
    if (customMessage !== undefined && customMessage !== '') {
        return customMessage;
    }
    return getErrorMessage(error);
}

/**
 * Logs error to console with context
 */
function logError(context: string, error: RendererDataValue): void {
    appLogger.error(context, getErrorMessage(error), error as Error);
}

export function handleError(
    error: RendererDataValue,
    context: string,
    options: ErrorDisplayOptions = {}
): string {
    const {
        showToast = false,
        logToConsole = true,
        customMessage,
        userFacing = true,
        onRecoverySuggested
    } = options;

    const message = resolveErrorMessage(error, customMessage);
    const recovery = getErrorRecoveryStrategy(error);

    if (logToConsole) {
        logError(context, error);
    }

    onRecoverySuggested?.(recovery);

    const userMessage = userFacing ? mapToUserFriendlyMessage(message) : message;

    if (showToast) {
        showErrorToast(userMessage);
    }

    return userMessage;
}


