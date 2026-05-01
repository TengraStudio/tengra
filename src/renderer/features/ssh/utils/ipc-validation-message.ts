/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

interface TranslatorFunction {
    (key: string, params?: Record<string, string | number>): string;
}

const IPC_VALIDATION_KEYS = [
    'frontend.errors.ipcValidation.hostRequired',
    'frontend.errors.ipcValidation.usernameRequired',
    'frontend.errors.ipcValidation.tokenRequired',
    'frontend.errors.ipcValidation.invalidUrlOrProtocol'
] as const;

/**
 * Replaces known IPC validation keys in an error payload with localized text.
 */
export function localizeIpcValidationMessage(message: string, t: TranslatorFunction): string {
    return IPC_VALIDATION_KEYS.reduce((currentMessage, key) => {
        return currentMessage.split(key).join(t(key));
    }, message);
}
