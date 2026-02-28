import {
    QUOTA_PERFORMANCE_BUDGETS,
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
    });
});
