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
    QUOTA_PERFORMANCE_BUDGETS,
    QuotaError,
    QuotaErrorCode,
    QuotaTelemetryEvent
} from '@main/services/proxy/quota.service';
import { describe, expect, it } from 'vitest';

describe('QuotaService Integration - Exports & Contracts', () => {
    describe('QuotaErrorCode enum completeness', () => {
        it('should export all standardized error codes', () => {
            const values = Object.values(QuotaErrorCode);
            expect(values.length).toBeGreaterThanOrEqual(5);
            expect(values).toContain('QUOTA_INVALID_SESSION_KEY');
            expect(values).toContain('QUOTA_FETCH_FAILED');
            expect(values).toContain('QUOTA_AUTH_EXPIRED');
            expect(values).toContain('QUOTA_NO_ACCOUNTS');
            expect(values).toContain('QUOTA_PARSE_FAILED');
        });

        it('should have unique values with no duplicates', () => {
            const values = Object.values(QuotaErrorCode);
            expect(new Set(values).size).toBe(values.length);
        });

        it('should include QUOTA_EXCEEDED, REFRESH_FAILED, ACCOUNT_LOCKED', () => {
            expect(QuotaErrorCode.QUOTA_EXCEEDED).toBe('QUOTA_EXCEEDED');
            expect(QuotaErrorCode.REFRESH_FAILED).toBe('QUOTA_REFRESH_FAILED');
            expect(QuotaErrorCode.ACCOUNT_LOCKED).toBe('QUOTA_ACCOUNT_LOCKED');
        });

        it('should have exactly 9 error codes', () => {
            expect(Object.keys(QuotaErrorCode)).toHaveLength(9);
        });
    });

    describe('QuotaTelemetryEvent enum completeness', () => {
        it('should export all 6 telemetry events', () => {
            const values = Object.values(QuotaTelemetryEvent);
            expect(values).toHaveLength(6);
            expect(values).toContain('quota_fetched');
            expect(values).toContain('quota_fetch_failed');
            expect(values).toContain('quota_codex_usage_fetched');
            expect(values).toContain('quota_claude_quota_fetched');
            expect(values).toContain('quota_copilot_quota_fetched');
            expect(values).toContain('quota_auth_expired');
        });

        it('should have unique values with no duplicates', () => {
            const values = Object.values(QuotaTelemetryEvent);
            expect(new Set(values).size).toBe(values.length);
        });

        it('should use snake_case naming convention', () => {
            for (const value of Object.values(QuotaTelemetryEvent)) {
                expect(value).toMatch(/^[a-z_]+$/);
            }
        });
    });

    describe('QUOTA_PERFORMANCE_BUDGETS contract', () => {
        it('should have exactly 5 budget entries', () => {
            expect(Object.keys(QUOTA_PERFORMANCE_BUDGETS)).toHaveLength(5);
        });

        it('should have all budget values as positive numbers', () => {
            const keys: (keyof typeof QUOTA_PERFORMANCE_BUDGETS)[] = [
                'FETCH_QUOTA_MS', 'FETCH_CODEX_USAGE_MS',
                'FETCH_CLAUDE_QUOTA_MS', 'FETCH_COPILOT_QUOTA_MS',
                'SAVE_SESSION_MS'
            ];
            for (const key of keys) {
                expect(QUOTA_PERFORMANCE_BUDGETS[key]).toBeTypeOf('number');
                expect(QUOTA_PERFORMANCE_BUDGETS[key]).toBeGreaterThan(0);
            }
        });

        it('should enforce reasonable upper bounds for budgets', () => {
            expect(QUOTA_PERFORMANCE_BUDGETS.FETCH_QUOTA_MS).toBeLessThanOrEqual(30000);
            expect(QUOTA_PERFORMANCE_BUDGETS.FETCH_CODEX_USAGE_MS).toBeLessThanOrEqual(30000);
            expect(QUOTA_PERFORMANCE_BUDGETS.FETCH_CLAUDE_QUOTA_MS).toBeLessThanOrEqual(30000);
            expect(QUOTA_PERFORMANCE_BUDGETS.FETCH_COPILOT_QUOTA_MS).toBeLessThanOrEqual(30000);
            expect(QUOTA_PERFORMANCE_BUDGETS.SAVE_SESSION_MS).toBeLessThanOrEqual(10000);
        });

        it('should have SAVE_SESSION_MS as the smallest budget', () => {
            const fetchBudgets = [
                QUOTA_PERFORMANCE_BUDGETS.FETCH_QUOTA_MS,
                QUOTA_PERFORMANCE_BUDGETS.FETCH_CODEX_USAGE_MS,
                QUOTA_PERFORMANCE_BUDGETS.FETCH_CLAUDE_QUOTA_MS,
                QUOTA_PERFORMANCE_BUDGETS.FETCH_COPILOT_QUOTA_MS
            ];
            for (const budget of fetchBudgets) {
                expect(QUOTA_PERFORMANCE_BUDGETS.SAVE_SESSION_MS).toBeLessThanOrEqual(budget);
            }
        });
    });

    describe('QuotaError regression', () => {
        it('should preserve prototype chain for instanceof checks', () => {
            const error = new QuotaError('test', QuotaErrorCode.FETCH_FAILED);
            expect(error).toBeInstanceOf(QuotaError);
            expect(error).toBeInstanceOf(Error);
        });

        it('should carry context across all error codes', () => {
            const codes = Object.values(QuotaErrorCode);
            for (const code of codes) {
                const error = new QuotaError(`test-${code}`, code, { provider: 'test' });
                expect(error.quotaCode).toBe(code);
                expect(error.context).toEqual({ provider: 'test' });
                expect(error.message).toBe(`test-${code}`);
            }
        });

        it('should always include a timestamp', () => {
            const error = new QuotaError('test', QuotaErrorCode.QUOTA_EXCEEDED);
            expect(error.timestamp).toBeDefined();
            const ts = new Date(error.timestamp).getTime();
            expect(Number.isNaN(ts)).toBe(false);
        });

        it('should default context to undefined when not provided', () => {
            const error = new QuotaError('test', QuotaErrorCode.NO_ACCOUNTS);
            expect(error.context).toBeUndefined();
        });
    });

    describe('Error code to i18n key mapping stability', () => {
        it('should have stable code string values for UI consumption', () => {
            const expectedMapping: Record<string, string> = {
                INVALID_SESSION_KEY: 'QUOTA_INVALID_SESSION_KEY',
                INVALID_INPUT: 'QUOTA_INVALID_INPUT',
                FETCH_FAILED: 'QUOTA_FETCH_FAILED',
                AUTH_EXPIRED: 'QUOTA_AUTH_EXPIRED',
                NO_ACCOUNTS: 'QUOTA_NO_ACCOUNTS',
                PARSE_FAILED: 'QUOTA_PARSE_FAILED',
                QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
                REFRESH_FAILED: 'QUOTA_REFRESH_FAILED',
                ACCOUNT_LOCKED: 'QUOTA_ACCOUNT_LOCKED'
            };
            for (const [key, value] of Object.entries(expectedMapping)) {
                expect(QuotaErrorCode[key as keyof typeof QuotaErrorCode]).toBe(value);
            }
        });
    });
});
