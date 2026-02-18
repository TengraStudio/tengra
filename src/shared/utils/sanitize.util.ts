/**
 * Input sanitization utilities for user-provided data
 */

/**
 * Sanitizes a string input by removing potentially dangerous characters
 * and normalizing whitespace.
 * 
 * @param input - The input string to sanitize
 * @param options - Sanitization options
 * @returns Sanitized string
 */
export function sanitizeString(
    input: string,
    options: {
        maxLength?: number
        allowNewlines?: boolean
        allowSpecialChars?: boolean
        trimWhitespace?: boolean
    } = {}
): string {
    const {
        maxLength = 1000000, // Default 1MB of text
        allowNewlines = true,
        trimWhitespace = true
    } = options;

    if (typeof input !== 'string') {
        return '';
    }

    let sanitized = input;

    // Trim whitespace if requested
    if (trimWhitespace) {
        sanitized = sanitized.trim();
    }

    // Remove null bytes and control characters (except newlines if allowed)
    if (allowNewlines) {
        // Keep newlines, tabs, and carriage returns, but remove other control chars
        // eslint-disable-next-line no-control-regex
        sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    } else {
        // Remove all control characters including newlines
        // eslint-disable-next-line no-control-regex
        sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');
    }

    // Remove potentially dangerous Unicode characters
    // Remove zero-width characters
    sanitized = sanitized.replace(/[\u200B-\u200D\uFEFF]/g, '');

    // Limit length
    if (sanitized.length > maxLength) {
        sanitized = sanitized.substring(0, maxLength);
    }

    return sanitized;
}

/**
 * Sanitizes a filename by removing dangerous characters and path traversal attempts
 * 
 * @param filename - The filename to sanitize
 * @returns Sanitized filename
 */
export function sanitizeFilename(filename: string): string {
    if (typeof filename !== 'string') {
        return '';
    }

    // Remove path separators and dangerous characters
    let sanitized = filename
        .replace(/[/\\?*|"<>:]/g, '') // Remove path separators and invalid chars
        .replace(/^\.+/, '') // Remove leading dots
        .replace(/\.+$/, '') // Remove trailing dots
        .trim();

    // Remove control characters
    // eslint-disable-next-line no-control-regex
    sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');

    // Limit length
    if (sanitized.length > 255) {
        sanitized = sanitized.substring(0, 255);
    }

    return sanitized || 'unnamed';
}

/**
 * Sanitizes a URL by validating and cleaning it
 * 
 * @param url - The URL to sanitize
 * @returns Sanitized URL or empty string if invalid
 */
export function sanitizeUrl(url: string): string {
    if (typeof url !== 'string') {
        return '';
    }

    const trimmed = url.trim();

    // Basic URL validation
    try {
        const parsed = new URL(trimmed);

        // Only allow http, https, and data URLs
        if (!['http:', 'https:', 'data:'].includes(parsed.protocol)) {
            return '';
        }

        return parsed.toString();
    } catch {
        // If URL parsing fails, return empty string
        return '';
    }
}

/**
 * Sanitizes a JSON string by parsing and re-stringifying it
 * This removes any potential code injection attempts
 * 
 * @param jsonString - The JSON string to sanitize
 * @returns Sanitized JSON string or empty string if invalid
 */
export function sanitizeJson(jsonString: string): string {
    if (typeof jsonString !== 'string') {
        return '';
    }

    try {
        const parsed = JSON.parse(jsonString);
        return JSON.stringify(parsed);
    } catch {
        return '';
    }
}

/**
 * Safely parses a JSON string, returning a default value if parsing fails
 * This prevents runtime crashes from malformed JSON data
 * 
 * @param jsonString - The JSON string to parse
 * @param defaultValue - The default value to return if parsing fails
 * @returns Parsed JSON object or the default value
 */
export function safeJsonParse<T>(jsonString: string | null | undefined, defaultValue: T): T {
    if (typeof jsonString !== 'string' || jsonString.trim() === '') {
        return defaultValue;
    }

    try {
        return JSON.parse(jsonString) as T;
    } catch {
        return defaultValue;
    }
}

/**
 * Sanitizes an array of strings
 * 
 * @param inputs - Array of strings to sanitize
 * @param options - Sanitization options
 * @returns Array of sanitized strings
 */
export function sanitizeStringArray(
    inputs: string[],
    options: Parameters<typeof sanitizeString>[1] = {}
): string[] {
    if (!Array.isArray(inputs)) {
        return [];
    }

    return inputs
        .filter(input => typeof input === 'string')
        .map(input => sanitizeString(input, options))
        .filter(input => input.length > 0);
}

/**
 * Sanitizes an object by recursively sanitizing all string values
 * 
 * @param obj - The object to sanitize
 * @param options - Sanitization options
 * @returns Sanitized object
 */
export function sanitizeObject<T extends Record<string, unknown>>(
    obj: T | null | undefined,
    options: Parameters<typeof sanitizeString>[1] = {}
): T | null | undefined {
    if (obj === null || obj === undefined) {
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(item => {
            if (typeof item === 'object' && item !== null) {
                return sanitizeObject(item as Record<string, unknown>, options);
            }

            return item;
        }) as unknown as T;
    }

    const sanitized = {} as T;

    for (const [key, value] of Object.entries(obj)) {
        const sanitizedKey = sanitizeString(key, { maxLength: 100, allowNewlines: false });

        if (typeof value === 'string') {
            ; (sanitized as Record<string, unknown>)[sanitizedKey] = sanitizeString(value, options);
        } else if (typeof value === 'object' && value !== null) {
            ; (sanitized as Record<string, unknown>)[sanitizedKey] = sanitizeObject(value as Record<string, unknown>, options);
        } else {
            ; (sanitized as Record<string, unknown>)[sanitizedKey] = value;
        }
    }

    return sanitized;
}

/**
 * Sanitizes SQL-like input to prevent injection
 * Note: This is a basic sanitization. Always use parameterized queries in production.
 * 
 * @param input - The input string to sanitize
 * @returns Sanitized string
 */
export function sanitizeSqlInput(input: string): string {
    if (typeof input !== 'string') {
        return '';
    }

    // Remove SQL comment syntax
    let sanitized = input.replace(/--/g, '');
    sanitized = sanitized.replace(/\/\*[\s\S]*?\*\//g, '');

    // Remove semicolons (statement terminators)
    sanitized = sanitized.replace(/;/g, '');

    // Remove common SQL keywords that could be used for injection
    const dangerousKeywords = [
        /\bDROP\s+TABLE\b/gi,
        /\bDELETE\s+FROM\b/gi,
        /\bINSERT\s+INTO\b/gi,
        /\bUPDATE\s+SET\b/gi,
        /\bALTER\s+TABLE\b/gi,
        /\bCREATE\s+TABLE\b/gi,
        /\bEXEC\b/gi,
        /\bEXECUTE\b/gi,
        /\bUNION\s+SELECT\b/gi
    ];

    for (const keyword of dangerousKeywords) {
        sanitized = sanitized.replace(keyword, '');
    }

    return sanitized.trim();
}

/**
 * Safely quotes a string for use as a shell argument.
 * Handles both Windows (PowerShell) and POSIX (sh/bash) styles roughly,
 * but emphasizes PowerShell safety since that's the default shell in this app.
 * 
 * @param arg - The argument to quote
 * @returns Quoted argument
 */
export function quoteShellArg(arg: string): string {
    if (!arg || arg.trim() === '') {
        return "''";
    }

    // Windows PowerShell safer quoting:
    // Enclose in single quotes, escape existing single quotes by doubling them.
    // This is generally safe for simple arguments in PowerShell.
    // e.g. "foo'bar" -> "'foo''bar'"
    return `'${arg.replace(/'/g, "''")}'`;
}
