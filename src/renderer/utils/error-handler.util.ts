import { en } from '@renderer/i18n/en';
import { tr } from '@renderer/i18n/tr';
import { JsonValue } from '@shared/types/common';
import { getErrorMessage, getErrorRecoveryStrategy } from '@shared/utils/error.util';

import { appLogger } from '@/utils/renderer-logger';

interface CustomWindow extends Window {
    showToast?: (options: { type: string; message: string }) => void
}

type SupportedLanguage = 'tr' | 'en';

const TRANSLATIONS: Record<SupportedLanguage, JsonValue> = {
    tr,
    en
};

function isSupportedLanguage(value: string): value is SupportedLanguage {
    return value === 'tr' || value === 'en';
}

function getTranslationNode(root: JsonValue, path: string): string | null {
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

function resolveTranslatedMessage(path: string): string {
    const langCandidate = typeof document === 'undefined'
        ? 'en'
        : document.documentElement.lang.split('-')[0].toLowerCase();
    const language: SupportedLanguage = isSupportedLanguage(langCandidate) ? langCandidate : 'en';
    const activeValue = getTranslationNode(TRANSLATIONS[language], path);
    const fallbackValue = getTranslationNode(TRANSLATIONS.en, path);
    return activeValue ?? fallbackValue ?? path;
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
    if (message.includes('429') || message.includes('rate limit') || message.includes('quota')) {
        return resolveTranslatedMessage('errors.rateLimit.exceeded');
    }
    if (message.includes('401') || message.includes('unauthorized')) {
        return resolveTranslatedMessage('errors.proxy.authFailed');
    }
    if (message.includes('network') || message.includes('fetch')) {
        return resolveTranslatedMessage('common.networkError');
    }
    if (message.includes('timeout')) {
        return resolveTranslatedMessage('errors.proxy.timeout');
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

