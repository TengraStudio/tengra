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
    PORT_MAX,
    PORT_MIN,
    validateInterval,
    validateOAuthTimeoutMs,
    validatePort,
    validateProvider,
    validateProxyUrl,
    validateToken
} from '@main/services/proxy/proxy-validation.util';
import { describe, expect, it } from 'vitest';

describe('proxy-validation.util', () => {
    describe('validatePort', () => {
        it('should accept valid port numbers', () => {
            expect(validatePort(80)).toBeUndefined();
            expect(validatePort(443)).toBeUndefined();
            expect(validatePort(8317)).toBeUndefined();
            expect(validatePort(PORT_MIN)).toBeUndefined();
            expect(validatePort(PORT_MAX)).toBeUndefined();
        });

        it('should reject negative ports', () => {
            expect(validatePort(-1)).toContain('between');
        });

        it('should reject zero', () => {
            expect(validatePort(0)).toContain('between');
        });

        it('should reject ports above 65535', () => {
            expect(validatePort(65536)).toContain('between');
            expect(validatePort(100000)).toContain('between');
        });

        it('should reject non-integer ports', () => {
            expect(validatePort(80.5)).toContain('integer');
            expect(validatePort(3.14)).toContain('integer');
        });

        it('should reject NaN and Infinity', () => {
            expect(validatePort(NaN)).toContain('finite');
            expect(validatePort(Infinity)).toContain('finite');
            expect(validatePort(-Infinity)).toContain('finite');
        });

        it('should reject null and undefined', () => {
            expect(validatePort(null)).toContain('required');
            expect(validatePort(undefined)).toContain('required');
        });

        it('should reject non-number types', () => {
            expect(validatePort('8080')).toContain('finite');
            expect(validatePort(true)).toContain('finite');
        });
    });

    describe('validateProxyUrl', () => {
        it('should accept valid http URLs', () => {
            expect(validateProxyUrl('http://127.0.0.1:8317/v1')).toBeUndefined();
            expect(validateProxyUrl('http://localhost:8080')).toBeUndefined();
            expect(validateProxyUrl('https://proxy.example.com')).toBeUndefined();
        });

        it('should reject non-http protocols', () => {
            expect(validateProxyUrl('ftp://example.com')).toContain('http or https');
            expect(validateProxyUrl('file:///etc/passwd')).toContain('http or https');
        });

        it('should reject invalid URLs', () => {
            expect(validateProxyUrl('not-a-url')).toContain('not a valid URL');
            expect(validateProxyUrl('://missing-protocol')).toContain('not a valid URL');
        });

        it('should reject empty and whitespace strings', () => {
            expect(validateProxyUrl('')).toContain('empty');
            expect(validateProxyUrl('   ')).toContain('empty');
        });

        it('should reject null, undefined, non-string types', () => {
            expect(validateProxyUrl(null)).toContain('required');
            expect(validateProxyUrl(undefined)).toContain('required');
            expect(validateProxyUrl(123)).toContain('string');
        });
    });

    describe('validateToken', () => {
        it('should accept valid tokens', () => {
            expect(validateToken('abc123')).toBeUndefined();
            expect(validateToken('gho_someGitHubToken')).toBeUndefined();
        });

        it('should reject empty tokens', () => {
            expect(validateToken('')).toContain('empty');
            expect(validateToken('   ')).toContain('empty');
        });

        it('should reject null and undefined', () => {
            expect(validateToken(null)).toContain('required');
            expect(validateToken(undefined)).toContain('required');
        });

        it('should reject non-string types', () => {
            expect(validateToken(123)).toContain('string');
            expect(validateToken(true)).toContain('string');
        });

        it('should reject excessively long tokens', () => {
            const longToken = 'x'.repeat(9000);
            expect(validateToken(longToken)).toContain('maximum length');
        });

        it('should use custom label in error messages', () => {
            expect(validateToken('', 'Access token')).toContain('Access token');
            expect(validateToken(null, 'Device code')).toContain('Device code');
        });
    });

    describe('validateInterval', () => {
        it('should accept positive numbers', () => {
            expect(validateInterval(1)).toBeUndefined();
            expect(validateInterval(5)).toBeUndefined();
            expect(validateInterval(0.5)).toBeUndefined();
        });

        it('should reject zero', () => {
            expect(validateInterval(0)).toContain('positive');
        });

        it('should reject negative numbers', () => {
            expect(validateInterval(-1)).toContain('positive');
            expect(validateInterval(-100)).toContain('positive');
        });

        it('should reject NaN and Infinity', () => {
            expect(validateInterval(NaN)).toContain('finite');
            expect(validateInterval(Infinity)).toContain('finite');
        });

        it('should reject null and undefined', () => {
            expect(validateInterval(null)).toContain('required');
            expect(validateInterval(undefined)).toContain('required');
        });
    });

    describe('validateProvider', () => {
        it('should accept valid provider strings', () => {
            expect(validateProvider('github')).toBeUndefined();
            expect(validateProvider('codex')).toBeUndefined();
            expect(validateProvider('claude')).toBeUndefined();
        });

        it('should reject empty and whitespace strings', () => {
            expect(validateProvider('')).toContain('empty');
            expect(validateProvider('   ')).toContain('empty');
        });

        it('should reject null, undefined, non-string types', () => {
            expect(validateProvider(null)).toContain('required');
            expect(validateProvider(undefined)).toContain('required');
            expect(validateProvider(42)).toContain('string');
        });
    });

    describe('validateOAuthTimeoutMs', () => {
        it('should accept in-range integer timeouts', () => {
            expect(validateOAuthTimeoutMs(10_000)).toBeUndefined();
            expect(validateOAuthTimeoutMs(30_000)).toBeUndefined();
            expect(validateOAuthTimeoutMs(600_000)).toBeUndefined();
        });

        it('should reject out-of-range timeouts', () => {
            expect(validateOAuthTimeoutMs(9_999)).toContain('between');
            expect(validateOAuthTimeoutMs(600_001)).toContain('between');
        });

        it('should reject non-integer and non-finite values', () => {
            expect(validateOAuthTimeoutMs(15_000.5)).toContain('integer');
            expect(validateOAuthTimeoutMs(NaN)).toContain('finite');
            expect(validateOAuthTimeoutMs(Infinity)).toContain('finite');
        });

        it('should reject null/undefined', () => {
            expect(validateOAuthTimeoutMs(null)).toContain('required');
            expect(validateOAuthTimeoutMs(undefined)).toContain('required');
        });
    });
});
