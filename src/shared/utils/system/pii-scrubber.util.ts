/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import * as path from 'path';

import { app } from 'electron';

type UnsafeValue = ReturnType<typeof JSON.parse>;

/**
 * Common PII patterns to scrub from logs and telemetry
 */
const PII_PATTERNS = {
    // Email addresses
    EMAIL: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    
    // API Keys / Secrets (heuristic-based)
    // Common formats: sk-..., key-..., auth-..., or long hex/base64 strings
    API_KEY: /(?:sk-|key-|auth-|ghp_|github_pat_)[a-zA-Z0-9]{20,}/g,
    
    // Generic high-entropy strings (might be keys)
    ENTROPY: /[a-zA-Z0-9+/]{40,}/g,
    
    // IPv4 addresses (optional, sometimes useful for debugging but can be PII)
    IPV4: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
};

/**
 * Utility for scrubbing PII from strings and objects
 */
export class PIIScrubber {
    private static userHome: string | null = null;
    private static userName: string | null = null;

    private static initialize() {
        if (this.userHome) {return;}
        try {
            this.userHome = app.getPath('home');
            this.userName = path.basename(this.userHome);
        } catch {
            // Fallback for renderer or utility processes if needed
            this.userHome = null;
            this.userName = null;
        }
    }

    /**
     * Scrubs PII from a string
     */
    static scrubString(str: string): string {
        this.initialize();
        if (!str) {return str;}

        let scrubbed = str;

        // Replace user home with ~
        if (this.userHome) {
            // Escape backslashes for regex if on Windows
            const escapedHome = this.userHome.replace(/\\/g, '\\\\');
            const homeRegex = new RegExp(escapedHome, 'gi');
            scrubbed = scrubbed.replace(homeRegex, '~');
        }

        // Replace user name if it appears elsewhere
        if (this.userName && this.userName.length > 2) {
            const userRegex = new RegExp(this.userName, 'gi');
            scrubbed = scrubbed.replace(userRegex, '<USER>');
        }

        // Apply pattern-based scrubbing
        scrubbed = scrubbed.replace(PII_PATTERNS.EMAIL, '<EMAIL>');
        scrubbed = scrubbed.replace(PII_PATTERNS.API_KEY, '<KEY>');
        
        // We only scrub high entropy if it's likely a key, to avoid false positives in base64 data
        // For now, let's keep it conservative
        
        return scrubbed;
    }

    /**
     * Recursively scrubs PII from an object with circular reference protection
     */
    static scrubObject<T>(obj: T, seen: WeakSet<object> = new WeakSet()): T {
        if (obj === null || obj === undefined) {return obj;}
        
        if (typeof obj === 'string') {
            return this.scrubString(obj) as UnsafeValue as T;
        }
        
        if (typeof obj !== 'object') {
            return obj;
        }

        // Handle arrays
        if (Array.isArray(obj)) {
            if (seen.has(obj)) {return '[Circular]' as UnsafeValue as T;}
            seen.add(obj);
            return obj.map(item => this.scrubObject(item, seen)) as UnsafeValue as T;
        }
        
        // Handle objects
        if (seen.has(obj)) {return '[Circular]' as UnsafeValue as T;}
        seen.add(obj);

        // Special handling for Error objects to preserve stack and message
        if (obj instanceof Error) {
            const scrubbedError = new (obj.constructor as UnsafeValue)(this.scrubString(obj.message));
            scrubbedError.stack = this.scrubString(obj.stack || '');
            // Copy other properties
            for (const key in obj) {
                if (Object.prototype.hasOwnProperty.call(obj, key) && key !== 'message' && key !== 'stack') {
                    (scrubbedError as UnsafeValue)[key] = this.scrubObject((obj as UnsafeValue)[key], seen);
                }
            }
            return scrubbedError as T;
        }

        const scrubbed: Record<string, UnsafeValue> = {};
        const source = obj as Record<string, UnsafeValue>;
        
        for (const key in source) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                // Scrub keys that are known to be sensitive
                if (this.isSensitiveKey(key)) {
                    scrubbed[key] = '<SCRUBBED>';
                } else {
                    scrubbed[key] = this.scrubObject(source[key], seen);
                }
            }
        }
        return scrubbed as T;
    }

    private static isSensitiveKey(key: string): boolean {
        const sensitiveKeys = [
            'password', 'token', 'key', 'secret', 'auth', 'authorization',
            'email', 'username', 'password', 'credential', 'apikey'
        ];
        const lowerKey = key.toLowerCase();
        return sensitiveKeys.some(s => lowerKey.includes(s));
    }
}
