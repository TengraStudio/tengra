/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * Unit tests for HealthCheckService
 */
import { HealthCheckService } from '@main/services/system/health-check.service';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let service: HealthCheckService;

beforeEach(() => {
    vi.useFakeTimers();
    service = new HealthCheckService();
});

afterEach(() => {
    service.stop();
    vi.useRealTimers();
});

describe('HealthCheckService - Management', () => {
    describe('register', () => {
        it('should register a health check', () => {
            service.register('test-service', async () => true);

            const status = service.getStatus();
            expect(status.services).toHaveLength(1);
            expect(status.services[0]!.name).toBe('test-service');
            expect(status.services[0]!.status).toBe('unknown');
        });

        it('should register with default options', () => {
            service.register('test-service', async () => true);

            const status = service.getStatus();
            expect(status.services[0]!.status).toBe('unknown');
        });

        it('should register multiple checks', () => {
            service.register('service1', async () => true);
            service.register('service2', async () => true);
            service.register('service3', async () => true);

            const status = service.getStatus();
            expect(status.services).toHaveLength(3);
        });
    });

    describe('start and stop', () => {
        it('should run checks on start', async () => {
            const checkFn = vi.fn().mockResolvedValue(true);
            service.register('test-service', checkFn);

            service.start();
            // Give it time to run
            await vi.advanceTimersByTimeAsync(100);

            expect(checkFn).toHaveBeenCalled();
        });

        it('should be stoppable', () => {
            const checkFn = vi.fn().mockResolvedValue(true);
            service.register('test-service', checkFn, { intervalMs: 1000 });

            service.start();
            service.stop();

            // Just verify stop doesn't throw
            expect(true).toBe(true);
        });

        it('should not double-start', async () => {
            const checkFn = vi.fn().mockResolvedValue(true);
            service.register('test-service', checkFn);

            service.start();
            service.start();
            await vi.advanceTimersByTimeAsync(100);

            // Should only run once even with double start
            expect(checkFn).toHaveBeenCalledTimes(1);
        });
    });
});

describe('HealthCheckService - Status Analysis', () => {
    it('should return overall healthy when all checks pass', async () => {
        service.register('service1', async () => true);
        service.register('service2', async () => true);

        service.start();
        await vi.advanceTimersByTimeAsync(100);

        const status = service.getStatus();
        expect(status.overall).toBe('healthy');
    });

    it('should return degraded when non-critical check fails', async () => {
        service.register('critical-service', async () => true, { critical: true });
        service.register('optional-service', async () => false, { critical: false });

        service.start();
        await vi.advanceTimersByTimeAsync(100);

        const status = service.getStatus();
        expect(status.overall).toBe('degraded');
    });

    it('should return unhealthy when critical check fails', async () => {
        service.register('critical-service', async () => false, { critical: true });
        service.register('optional-service', async () => true, { critical: false });

        service.start();
        await vi.advanceTimersByTimeAsync(100);

        const status = service.getStatus();
        expect(status.overall).toBe('unhealthy');
    });

    it('should include timestamp', () => {
        const status = service.getStatus();
        expect(status.timestamp).toBeInstanceOf(Date);
    });

    it('should include latency for completed checks', async () => {
        service.register('test-service', async () => true);

        service.start();
        await vi.advanceTimersByTimeAsync(100);

        const status = service.getStatus();
        expect(status.services[0]!.latencyMs).toBeDefined();
    });
});

describe('HealthCheckService - On-Demand & Events', () => {
    describe('checkNow', () => {
        it('should run check immediately and return result', async () => {
            service.register('test-service', async () => true);

            const result = await service.checkNow('test-service');

            expect(result).not.toBeNull();
            expect(result?.status).toBe('healthy');
        });

        it('should return null for unknown service', async () => {
            const result = await service.checkNow('unknown-service');
            expect(result).toBeNull();
        });

        it('should update status after check', async () => {
            let shouldPass = false;
            service.register('test-service', async () => shouldPass);

            await service.checkNow('test-service');
            expect(service.getStatus().services[0]!.status).toBe('unhealthy');

            shouldPass = true;
            await service.checkNow('test-service');
            expect(service.getStatus().services[0]!.status).toBe('healthy');
        });
    });

    describe('status change events', () => {
        it('should emit statusChange when status changes', async () => {
            const listener = vi.fn();
            service.on('statusChange', listener);

            let shouldPass = true;
            service.register('test-service', async () => shouldPass);

            service.start();
            await vi.advanceTimersByTimeAsync(100);

            // First check - unknown to healthy
            expect(listener).toHaveBeenCalled();
            expect(listener.mock.calls[0]![0].status).toBe('healthy');

            listener.mockClear();
            shouldPass = false;
            await service.checkNow('test-service');

            // Second check - healthy to unhealthy
            expect(listener).toHaveBeenCalled();
            expect(listener.mock.calls[0]![0].status).toBe('unhealthy');
        });

        it('should not emit when status unchanged', async () => {
            const listener = vi.fn();
            service.on('statusChange', listener);

            service.register('test-service', async () => true);

            service.start();
            await vi.advanceTimersByTimeAsync(100);
            listener.mockClear();

            // Run again with same result
            await service.checkNow('test-service');

            expect(listener).not.toHaveBeenCalled();
        });
    });

    describe('timeout and error handling', () => {
        it('should mark service unhealthy on timeout', async () => {
            service.register('slow-service', async () => {
                return new Promise<boolean>((resolve) => {
                    setTimeout(() => resolve(true), 10000);
                });
            }, { timeoutMs: 100 });

            service.start();
            await vi.advanceTimersByTimeAsync(200);

            const status = service.getStatus();
            expect(status.services[0]!.status).toBe('unhealthy');
            expect(status.services[0]!.error).toContain('Timeout');
        });

        it('should mark service unhealthy on error', async () => {
            service.register('error-service', async () => {
                throw new Error('Service unavailable');
            });

            service.start();
            await vi.advanceTimersByTimeAsync(100);

            const status = service.getStatus();
            expect(status.services[0]!.status).toBe('unhealthy');
            expect(status.services[0]!.error).toContain('Service unavailable');
        });
    });
});

