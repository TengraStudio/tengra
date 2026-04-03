/**
 * Input validation utilities for ProxyService and ProxyProcessManager.
 * Centralizes port, URL, token, and config validation logic.
 */

/** Minimum valid TCP/UDP port number */
export const PORT_MIN = 1;

/** Maximum valid TCP/UDP port number */
export const PORT_MAX = 65535;

/** Maximum allowed length for API keys and tokens */
const MAX_TOKEN_LENGTH = 8192;
const OAUTH_TIMEOUT_MIN_MS = 10_000;
const OAUTH_TIMEOUT_MAX_MS = 600_000;

/**
 * Validates that a value is a valid TCP/UDP port number.
 * @param port - The port number to validate
 * @returns An error message string if invalid, or undefined if valid
 */
export function validatePort(port: RuntimeValue): string | undefined {
    if (port === undefined || port === null) {
        return 'Port is required';
    }
    if (typeof port !== 'number' || !Number.isFinite(port)) {
        return 'Port must be a finite number';
    }
    if (!Number.isInteger(port)) {
        return 'Port must be an integer';
    }
    if (port < PORT_MIN || port > PORT_MAX) {
        return `Port must be between ${PORT_MIN} and ${PORT_MAX}`;
    }
    return undefined;
}

/**
 * Validates that a value is a valid proxy URL (http/https, loopback or hostname).
 * @param url - The URL string to validate
 * @returns An error message string if invalid, or undefined if valid
 */
export function validateProxyUrl(url: RuntimeValue): string | undefined {
    if (url === undefined || url === null) {
        return 'URL is required';
    }
    if (typeof url !== 'string') {
        return 'URL must be a string';
    }
    const trimmed = url.trim();
    if (trimmed.length === 0) {
        return 'URL must not be empty';
    }
    try {
        const parsed = new URL(trimmed);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return 'URL protocol must be http or https';
        }
    } catch {
        return 'URL is not a valid URL';
    }
    return undefined;
}

/**
 * Validates that an access token or API key is a non-empty string within safe bounds.
 * @param token - The token to validate
 * @param label - Human-readable label for error messages (e.g. "Access token")
 * @returns An error message string if invalid, or undefined if valid
 */
export function validateToken(token: RuntimeValue, label = 'Token'): string | undefined {
    if (token === undefined || token === null) {
        return `${label} is required`;
    }
    if (typeof token !== 'string') {
        return `${label} must be a string`;
    }
    if (token.trim().length === 0) {
        return `${label} must not be empty`;
    }
    if (token.length > MAX_TOKEN_LENGTH) {
        return `${label} exceeds maximum length of ${MAX_TOKEN_LENGTH}`;
    }
    return undefined;
}

/**
 * Validates that a polling interval is a positive finite number.
 * @param interval - The interval in seconds
 * @returns An error message string if invalid, or undefined if valid
 */
export function validateInterval(interval: RuntimeValue): string | undefined {
    if (interval === undefined || interval === null) {
        return 'Interval is required';
    }
    if (typeof interval !== 'number' || !Number.isFinite(interval)) {
        return 'Interval must be a finite number';
    }
    if (interval <= 0) {
        return 'Interval must be positive';
    }
    return undefined;
}

/**
 * Validates that a provider name is a non-empty trimmed string.
 * @param provider - The provider identifier
 * @returns An error message string if invalid, or undefined if valid
 */
export function validateProvider(provider: RuntimeValue): string | undefined {
    if (provider === undefined || provider === null) {
        return 'Provider is required';
    }
    if (typeof provider !== 'string') {
        return 'Provider must be a string';
    }
    if (provider.trim().length === 0) {
        return 'Provider must not be empty';
    }
    return undefined;
}

/**
 * Validates provider OAuth timeout (milliseconds) with strict bounds.
 * @param timeoutMs - Timeout value in milliseconds
 * @returns An error message string if invalid, or undefined if valid
 */
export function validateOAuthTimeoutMs(timeoutMs: RuntimeValue): string | undefined {
    if (timeoutMs === undefined || timeoutMs === null) {
        return 'OAuth timeout is required';
    }
    if (typeof timeoutMs !== 'number' || !Number.isFinite(timeoutMs)) {
        return 'OAuth timeout must be a finite number';
    }
    if (!Number.isInteger(timeoutMs)) {
        return 'OAuth timeout must be an integer';
    }
    if (timeoutMs < OAUTH_TIMEOUT_MIN_MS || timeoutMs > OAUTH_TIMEOUT_MAX_MS) {
        return `OAuth timeout must be between ${OAUTH_TIMEOUT_MIN_MS} and ${OAUTH_TIMEOUT_MAX_MS} ms`;
    }
    return undefined;
}
