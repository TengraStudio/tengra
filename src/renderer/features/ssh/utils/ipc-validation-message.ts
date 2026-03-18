interface TranslatorFunction {
    (key: string, params?: Record<string, string | number>): string;
}

const IPC_VALIDATION_KEYS = [
    'errors.ipcValidation.hostRequired',
    'errors.ipcValidation.usernameRequired',
    'errors.ipcValidation.tokenRequired',
    'errors.ipcValidation.invalidUrlOrProtocol'
] as const;

/**
 * Replaces known IPC validation keys in an error payload with localized text.
 */
export function localizeIpcValidationMessage(message: string, t: TranslatorFunction): string {
    return IPC_VALIDATION_KEYS.reduce((currentMessage, key) => {
        return currentMessage.split(key).join(t(key));
    }, message);
}
