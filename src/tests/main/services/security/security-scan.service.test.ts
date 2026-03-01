import { SecurityScanService } from '@main/services/security/security-scan.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { JobSchedulerService } from '@main/services/system/job-scheduler.service';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@main/logging/logger');
vi.mock('@main/services/system/event-bus.service');
vi.mock('@main/services/system/job-scheduler.service');
vi.mock('electron', () => ({
    app: { isPackaged: false, getAppPath: () => '/mock/app' }
}));
vi.mock('child_process', () => ({
    execFile: vi.fn()
}));

import { execFile } from 'child_process';

let service: SecurityScanService;
let mockEventBus: EventBusService;
let mockJobScheduler: JobSchedulerService;

beforeEach(() => {
    vi.clearAllMocks();

    mockEventBus = {
        emitCustom: vi.fn(),
        emit: vi.fn(),
        on: vi.fn().mockReturnValue(() => undefined),
        off: vi.fn()
    } as unknown as EventBusService;

    mockJobScheduler = {
        registerRecurringJob: vi.fn()
    } as unknown as JobSchedulerService;

    service = new SecurityScanService(mockEventBus, mockJobScheduler);
});

describe('SecurityScanService - Lifecycle', () => {
    it('should register a recurring job on initialize', async () => {
        await service.initialize();
        expect(mockJobScheduler.registerRecurringJob).toHaveBeenCalledWith(
            'security-scan-npm-audit',
            expect.any(Function),
            expect.any(Function)
        );
    });

    it('should return null for latestResult before any scan', () => {
        expect(service.getLatestResult()).toBeNull();
    });

    it('should complete cleanup without error', async () => {
        await expect(service.cleanup()).resolves.toBeUndefined();
    });
});

describe('SecurityScanService - runScan', () => {
    it('should parse metadata vulnerabilities from npm audit output', async () => {
        const auditOutput = JSON.stringify({
            metadata: {
                vulnerabilities: { critical: 1, high: 2, moderate: 3, low: 4, info: 5, total: 15 }
            }
        });

        vi.mocked(execFile).mockImplementation(
            (_cmd: unknown, _args: unknown, _opts: unknown, callback: unknown) => {
                (callback as (err: Error | null, stdout: string, stderr: string) => void)(null, auditOutput, '');
                return {} as ReturnType<typeof execFile>;
            }
        );

        const result = await service.runScan();

        expect(result.success).toBe(true);
        expect(result.vulnerabilities.critical).toBe(1);
        expect(result.vulnerabilities.high).toBe(2);
        expect(result.vulnerabilities.total).toBe(15);
        expect(service.getLatestResult()).toBe(result);
    });

    it('should emit event when critical/high vulnerabilities found', async () => {
        const auditOutput = JSON.stringify({
            metadata: {
                vulnerabilities: { critical: 3, high: 1, moderate: 0, low: 0, info: 0, total: 4 }
            }
        });

        vi.mocked(execFile).mockImplementation(
            (_cmd: unknown, _args: unknown, _opts: unknown, callback: unknown) => {
                (callback as (err: Error | null, stdout: string, stderr: string) => void)(null, auditOutput, '');
                return {} as ReturnType<typeof execFile>;
            }
        );

        await service.runScan();

        expect(mockEventBus.emitCustom).toHaveBeenCalledWith(
            'security:vulnerabilities-found',
            expect.objectContaining({ critical: 3, high: 1 })
        );
    });

    it('should not emit event when no critical/high vulnerabilities', async () => {
        const auditOutput = JSON.stringify({
            metadata: {
                vulnerabilities: { critical: 0, high: 0, moderate: 5, low: 2, info: 1, total: 8 }
            }
        });

        vi.mocked(execFile).mockImplementation(
            (_cmd: unknown, _args: unknown, _opts: unknown, callback: unknown) => {
                (callback as (err: Error | null, stdout: string, stderr: string) => void)(null, auditOutput, '');
                return {} as ReturnType<typeof execFile>;
            }
        );

        await service.runScan();

        expect(mockEventBus.emitCustom).not.toHaveBeenCalled();
    });

    it('should fallback to counting vulnerabilities map when no metadata', async () => {
        const auditOutput = JSON.stringify({
            vulnerabilities: {
                'pkg-a': { severity: 'critical' },
                'pkg-b': { severity: 'high' },
                'pkg-c': { severity: 'low' }
            }
        });

        vi.mocked(execFile).mockImplementation(
            (_cmd: unknown, _args: unknown, _opts: unknown, callback: unknown) => {
                (callback as (err: Error | null, stdout: string, stderr: string) => void)(null, auditOutput, '');
                return {} as ReturnType<typeof execFile>;
            }
        );

        const result = await service.runScan();

        expect(result.success).toBe(true);
        expect(result.vulnerabilities.critical).toBe(1);
        expect(result.vulnerabilities.high).toBe(1);
        expect(result.vulnerabilities.low).toBe(1);
        expect(result.vulnerabilities.total).toBe(3);
    });

    it('should handle invalid JSON output gracefully', async () => {
        vi.mocked(execFile).mockImplementation(
            (_cmd: unknown, _args: unknown, _opts: unknown, callback: unknown) => {
                (callback as (err: Error | null, stdout: string, stderr: string) => void)(null, 'not-json', '');
                return {} as ReturnType<typeof execFile>;
            }
        );

        const result = await service.runScan();

        expect(result.success).toBe(true);
        expect(result.vulnerabilities.total).toBe(0);
    });

    it('should return failure result when npm audit produces no output', async () => {
        vi.mocked(execFile).mockImplementation(
            (_cmd: unknown, _args: unknown, _opts: unknown, callback: unknown) => {
                (callback as (err: Error | null, stdout: string, stderr: string) => void)(
                    new Error('npm audit produced no output'), '', ''
                );
                return {} as ReturnType<typeof execFile>;
            }
        );

        const result = await service.runScan();

        expect(result.success).toBe(false);
        expect(result.errorMessage).toBeDefined();
        expect(result.vulnerabilities.total).toBe(0);
        expect(service.getLatestResult()).toBe(result);
    });
});
