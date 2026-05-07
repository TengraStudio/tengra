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
    PROXY_PERFORMANCE_BUDGETS,
    ProxyErrorCode,
    ProxyUsageStatsEvent} from '@main/services/proxy/proxy.service';
import { AppErrorCode, ProxyServiceError } from '@shared/utils/error.util';
import { describe, expect,it } from 'vitest';

describe('ProxyService Integration - Exports & Contracts', () => {
    describe('ProxyErrorCode completeness', () => {
        it('should export all 10 standardized error codes', () => {
            const values = Object.values(ProxyErrorCode);
            expect(values).toHaveLength(10);
            expect(values).toContain('PROXY_NOT_INITIALIZED');
            expect(values).toContain('PROXY_START_FAILED');
            expect(values).toContain('PROXY_STOP_FAILED');
            expect(values).toContain('PROXY_AUTH_FAILED');
            expect(values).toContain('PROXY_REQUEST_FAILED');
            expect(values).toContain('PROXY_INVALID_CONFIG');
            expect(values).toContain('PROXY_CONNECTION_FAILED');
            expect(values).toContain('PROXY_TIMEOUT');
            expect(values).toContain('PROXY_PORT_IN_USE');
            expect(values).toContain('PROXY_BINARY_NOT_FOUND');
        });

        it('should have unique values with no duplicates', () => {
            const values = Object.values(ProxyErrorCode);
            expect(new Set(values).size).toBe(values.length);
        });

        it('should map to AppErrorCode values', () => {
            expect(ProxyErrorCode.NOT_INITIALIZED).toBe(AppErrorCode.PROXY_NOT_INITIALIZED);
            expect(ProxyErrorCode.START_FAILED).toBe(AppErrorCode.PROXY_START_FAILED);
            expect(ProxyErrorCode.CONNECTION_FAILED).toBe(AppErrorCode.PROXY_CONNECTION_FAILED);
            expect(ProxyErrorCode.PORT_IN_USE).toBe(AppErrorCode.PROXY_PORT_IN_USE);
            expect(ProxyErrorCode.BINARY_NOT_FOUND).toBe(AppErrorCode.PROXY_BINARY_NOT_FOUND);
        });
    });

    describe('ProxyServiceError typed errors', () => {
        it('should create error with correct code and retryable flag', () => {
            const error = new ProxyServiceError(
                'Connection refused',
                AppErrorCode.PROXY_CONNECTION_FAILED,
                true,
                { port: 8317 }
            );
            expect(error.message).toBe('Connection refused');
            expect(error.code).toBe('PROXY_CONNECTION_FAILED');
            expect(error.retryable).toBe(true);
            expect(error.context).toEqual({ port: 8317 });
        });

        it('should default to PROXY_REQUEST_FAILED code', () => {
            const error = new ProxyServiceError('something failed');
            expect(error.code).toBe(AppErrorCode.PROXY_REQUEST_FAILED);
            expect(error.retryable).toBe(true);
        });

        it('should be instanceof Error and TengraError', () => {
            const error = new ProxyServiceError('test', AppErrorCode.PROXY_START_FAILED, false);
            expect(error).toBeInstanceOf(Error);
            expect(error.retryable).toBe(false);
            expect(error.name).toBe('ProxyServiceError');
        });

        it('should serialize via toJSON', () => {
            const error = new ProxyServiceError('fail', AppErrorCode.PROXY_TIMEOUT, true, { elapsed: 5000 });
            const json = error.toJSON();
            expect(json.code).toBe('PROXY_TIMEOUT');
            expect(json.message).toBe('fail');
            expect(json.context).toEqual({ elapsed: 5000 });
            expect(json.timestamp).toBeDefined();
        });
    });

    describe('ProxyUsageStatsEvent enum completeness', () => {
        it('should export all 8 Stats events', () => {
            const values = Object.values(ProxyUsageStatsEvent);
            expect(values).toHaveLength(8);
            expect(values).toContain('proxy_started');
            expect(values).toContain('proxy_stopped');
            expect(values).toContain('proxy_request_sent');
            expect(values).toContain('proxy_request_failed');
            expect(values).toContain('proxy_auth_initiated');
            expect(values).toContain('proxy_auth_completed');
            expect(values).toContain('proxy_auth_failed');
            expect(values).toContain('proxy_health_check');
        });

        it('should have unique values with no duplicates', () => {
            const values = Object.values(ProxyUsageStatsEvent);
            expect(new Set(values).size).toBe(values.length);
        });
    });

    describe('PROXY_PERFORMANCE_BUDGETS contract', () => {
        it('should have exactly 8 budget entries', () => {
            expect(Object.keys(PROXY_PERFORMANCE_BUDGETS)).toHaveLength(8);
        });

        it('should have all budget values as positive numbers', () => {
            const keys: (keyof typeof PROXY_PERFORMANCE_BUDGETS)[] = [
                'START_MS', 'STOP_MS', 'REQUEST_MS',
                'AUTH_MS', 'HEALTH_CHECK_MS', 'INITIALIZE_MS',
                'CONFIG_GENERATION_MS', 'GET_MODELS_MS'
            ];
            for (const key of keys) {
                expect(PROXY_PERFORMANCE_BUDGETS[key]).toBeTypeOf('number');
                expect(PROXY_PERFORMANCE_BUDGETS[key]).toBeGreaterThan(0);
            }
        });

        it('should enforce reasonable upper bounds for budgets', () => {
            expect(PROXY_PERFORMANCE_BUDGETS.START_MS).toBeLessThanOrEqual(30000);
            expect(PROXY_PERFORMANCE_BUDGETS.STOP_MS).toBeLessThanOrEqual(15000);
            expect(PROXY_PERFORMANCE_BUDGETS.REQUEST_MS).toBeLessThanOrEqual(60000);
            expect(PROXY_PERFORMANCE_BUDGETS.AUTH_MS).toBeLessThanOrEqual(60000);
            expect(PROXY_PERFORMANCE_BUDGETS.HEALTH_CHECK_MS).toBeLessThanOrEqual(15000);
            expect(PROXY_PERFORMANCE_BUDGETS.INITIALIZE_MS).toBeLessThanOrEqual(30000);
            expect(PROXY_PERFORMANCE_BUDGETS.CONFIG_GENERATION_MS).toBeLessThanOrEqual(10000);
            expect(PROXY_PERFORMANCE_BUDGETS.GET_MODELS_MS).toBeLessThanOrEqual(30000);
        });
    });
});

