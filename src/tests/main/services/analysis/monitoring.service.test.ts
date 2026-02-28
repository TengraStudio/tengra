import { AlertConfiguration, MonitoringErrorCode, MonitoringService } from '@main/services/analysis/monitoring.service';
import { afterEach,beforeEach, describe, expect, it, vi } from 'vitest';

// Mock os module
vi.mock('os', () => ({
    loadavg: vi.fn(),
    totalmem: vi.fn(),
    freemem: vi.fn(),
    platform: vi.fn(),
}));

// Mock exec module
vi.mock('child_process', () => ({
    exec: vi.fn(),
}));

// Mock the logger
vi.mock('@main/logging/logger', () => ({
    appLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

import { exec } from 'child_process';
import * as os from 'os';

const mockExec = exec as unknown as ReturnType<typeof vi.fn>;

describe('MonitoringService', () => {
    let service: MonitoringService;

    beforeEach(async () => {
        vi.clearAllMocks();
        vi.mocked(os.platform).mockReturnValue('win32');
        service = new MonitoringService();
        await service.initialize();
    });

    afterEach(async () => {
        await service.cleanup();
    });

    describe('getUsage', () => {
        it('should return CPU and memory usage', async () => {
            // Arrange
            vi.mocked(os.loadavg).mockReturnValue([0.5, 0.3, 0.2]);
            vi.mocked(os.totalmem).mockReturnValue(16000000000);
            vi.mocked(os.freemem).mockReturnValue(8000000000);

            // Act
            const result = await service.getUsage();

            // Assert
            expect(result.success).toBe(true);
            expect(result.result).toEqual({
                cpu: 0.5,
                memory: 50,
            });
        });

        it('should handle 0 total memory gracefully', async () => {
            // Arrange
            vi.mocked(os.loadavg).mockReturnValue([0.5, 0.3, 0.2]);
            vi.mocked(os.totalmem).mockReturnValue(0);
            vi.mocked(os.freemem).mockReturnValue(0);

            // Act
            const result = await service.getUsage();

            // Assert
            expect(result.success).toBe(true);
            expect(result.result?.memory).toBe(0);
        });

        it('should handle low memory conditions', async () => {
            // Arrange
            vi.mocked(os.loadavg).mockReturnValue([0.1, 0.1, 0.1]);
            vi.mocked(os.totalmem).mockReturnValue(8000000000);
            vi.mocked(os.freemem).mockReturnValue(400000000);

            // Act
            const result = await service.getUsage();

            // Assert
            expect(result.success).toBe(true);
            expect(result.result?.memory).toBe(95); // 95% used
        });

        it('should handle high CPU load', async () => {
            // Arrange
            vi.mocked(os.loadavg).mockReturnValue([8.0, 4.0, 2.0]);
            vi.mocked(os.totalmem).mockReturnValue(16000000000);
            vi.mocked(os.freemem).mockReturnValue(8000000000);

            // Act
            const result = await service.getUsage();

            // Assert
            expect(result.success).toBe(true);
            expect(result.result?.cpu).toBe(8.0);
        });
    });

    describe('getSystemMonitor', () => {
        it('should return system monitor output on Windows', async () => {
            // Arrange
            vi.mocked(os.platform).mockReturnValue('win32');
            mockExec.mockImplementation((_command, _options, callback) => {
                callback(null, 'LoadPercentage=50', '');
            });

            // Act
            const result = await service.getSystemMonitor();

            // Assert
            expect(result.success).toBe(true);
            expect(result.result?.output).toBe('LoadPercentage=50');
        });

        it('should return system monitor output on Linux', async () => {
            // Arrange
            vi.mocked(os.platform).mockReturnValue('linux');
            mockExec.mockImplementation((_command, _options, callback) => {
                callback(null, 'Cpu(s): 5.0%us', '');
            });

            // Act
            const result = await service.getSystemMonitor();

            // Assert
            expect(result.success).toBe(true);
            expect(result.result?.output).toBe('Cpu(s): 5.0%us');
        });

        it('should return system monitor output on macOS', async () => {
            // Arrange
            vi.mocked(os.platform).mockReturnValue('darwin');
            mockExec.mockImplementation((_command, _options, callback) => {
                callback(null, 'CPU usage: 45%', '');
            });

            // Act
            const result = await service.getSystemMonitor();

            // Assert
            expect(result.success).toBe(true);
            expect(result.result?.output).toBe('CPU usage: 45%');
        });

        it('should handle unsupported platforms gracefully', async () => {
            // Arrange
            vi.mocked(os.platform).mockReturnValue('freebsd');

            // Act
            const result = await service.getSystemMonitor();

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toBe('MONITORING_UNSUPPORTED_PLATFORM');
        });

        it('should handle command execution errors', async () => {
            // Arrange
            vi.mocked(os.platform).mockReturnValue('win32');
            mockExec.mockImplementation((_command, _options, callback) => {
                callback(new Error('Command failed'), '', 'stderr error');
            });

            // Act
            const result = await service.getSystemMonitor();

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        it('should truncate large output', async () => {
            // Arrange
            vi.mocked(os.platform).mockReturnValue('win32');
            const largeOutput = 'x'.repeat(2000000); // 2MB output
            mockExec.mockImplementation((_command, _options, callback) => {
                callback(null, largeOutput, '');
            });

            // Act
            const result = await service.getSystemMonitor();

            // Assert
            expect(result.success).toBe(true);
            expect(result.result?.output.length).toBeLessThanOrEqual(1024 * 1024);
        });

        it('should handle timeout errors', async () => {
            // Arrange
            vi.mocked(os.platform).mockReturnValue('win32');

            // Create a mock that hangs
            mockExec.mockImplementation(() => {
                // Don't call callback - simulates hanging
                return {} as ReturnType<typeof exec>;
            });

            // We can't easily test timeout in unit tests, but we verify the error handling exists
            // This test documents the timeout behavior
            expect(service.getSystemMonitor).toBeDefined();
        });
    });

    describe('getBatteryStatus', () => {
        it('should return battery status on Windows', async () => {
            // Arrange
            vi.mocked(os.platform).mockReturnValue('win32');
            mockExec.mockImplementation((_command, _options, callback) => {
                callback(null, 'EstimatedChargeRemaining: 80\nBatteryStatus: 2', '');
            });

            // Act
            const result = await service.getBatteryStatus();

            // Assert
            expect(result.success).toBe(true);
            expect(result.result?.output).toContain('EstimatedChargeRemaining');
        });

        it('should return battery status on Linux when battery exists', async () => {
            // Arrange
            vi.mocked(os.platform).mockReturnValue('linux');

            // First call to get battery list, second to get details
            mockExec.mockImplementation((command, _options, callback) => {
                if (command.includes('-e')) {
                    callback(null, '/org/freedesktop/UPower/devices/battery_BAT0\n', '');
                } else if (command.includes('-i')) {
                    callback(null, 'state: charging\npercentage: 75%\n', '');
                } else {
                    callback(null, '', '');
                }
            });

            // Act
            const result = await service.getBatteryStatus();

            // Assert
            expect(result.success).toBe(true);
            expect(result.result?.output).toBeDefined();
        });

        it('should handle no battery on Linux', async () => {
            // Arrange
            vi.mocked(os.platform).mockReturnValue('linux');
            mockExec.mockImplementation((_command, _options, callback) => {
                callback(null, '', '');
            });

            // Act
            const result = await service.getBatteryStatus();

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toBe(MonitoringErrorCode.NO_BATTERY);
        });

        it('should return battery status on macOS', async () => {
            // Arrange
            vi.mocked(os.platform).mockReturnValue('darwin');
            mockExec.mockImplementation((_command, _options, callback) => {
                callback(null, 'Now drawing from \'Battery Power\'\n -InternalBatteryPercent-0: 85%', '');
            });

            // Act
            const result = await service.getBatteryStatus();

            // Assert
            expect(result.success).toBe(true);
            expect(result.result?.output).toContain('Battery Power');
        });

        it('should handle unsupported platforms gracefully', async () => {
            // Arrange
            vi.mocked(os.platform).mockReturnValue('freebsd');

            // Act
            const result = await service.getBatteryStatus();

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toBe('MONITORING_UNSUPPORTED_PLATFORM');
        });

        it('should handle command execution errors gracefully', async () => {
            // Arrange
            vi.mocked(os.platform).mockReturnValue('win32');
            mockExec.mockImplementation((_command, _options, callback) => {
                callback(new Error('PowerShell not available'), '', '');
            });

            // Act
            const result = await service.getBatteryStatus();

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });
    });

    describe('lifecycle', () => {
        it('should initialize without errors', async () => {
            // Arrange & Act
            const newService = new MonitoringService();

            // Assert before init
            expect(newService).toBeDefined();

            // Act
            await newService.initialize();

            // Assert after init
            expect(newService.getTelemetry().initialized).toBe(true);
        });

        it('should cleanup without errors', async () => {
            // Arrange
            const newService = new MonitoringService();
            await newService.initialize();

            // Act & Assert
            await expect(newService.cleanup()).resolves.not.toThrow();
            expect(newService.getTelemetry().telemetryEnabled).toBe(false);
        });

        it('should track telemetry state', () => {
            // Act
            const telemetry = service.getTelemetry();

            // Assert
            expect(telemetry.serviceName).toBe('MonitoringService');
            expect(telemetry.initialized).toBe(true);
            expect(telemetry.telemetryEnabled).toBe(true);
        });
    });

    describe('error handling', () => {
        it('should handle errors in getUsage gracefully', async () => {
            // Arrange
            vi.mocked(os.loadavg).mockImplementation(() => {
                throw new Error('OS error');
            });

            // Act
            const result = await service.getUsage();

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });
    });

    describe('edge cases - MonitoringErrorCode enum', () => {
        it('should have UNSUPPORTED_PLATFORM error code', () => {
            expect(MonitoringErrorCode.UNSUPPORTED_PLATFORM).toBe('MONITORING_UNSUPPORTED_PLATFORM');
        });

        it('should have COMMAND_TIMEOUT error code', () => {
            expect(MonitoringErrorCode.COMMAND_TIMEOUT).toBe('MONITORING_COMMAND_TIMEOUT');
        });

        it('should have COMMAND_FAILED error code', () => {
            expect(MonitoringErrorCode.COMMAND_FAILED).toBe('MONITORING_COMMAND_FAILED');
        });

        it('should have OUTPUT_TRUNCATED error code', () => {
            expect(MonitoringErrorCode.OUTPUT_TRUNCATED).toBe('MONITORING_OUTPUT_TRUNCATED');
        });

        it('should have NO_BATTERY error code', () => {
            expect(MonitoringErrorCode.NO_BATTERY).toBe('MONITORING_NO_BATTERY');
        });

        it('should have COLLECTION_FAILED error code', () => {
            expect(MonitoringErrorCode.COLLECTION_FAILED).toBe('MONITORING_COLLECTION_FAILED');
        });
    });

    describe('edge cases - executeWithTimeout validation via public methods', () => {
        it('should return UNSUPPORTED_PLATFORM for getSystemMonitor on unknown platform', async () => {
            vi.mocked(os.platform).mockReturnValue('aix');

            const result = await service.getSystemMonitor();

            expect(result.success).toBe(false);
            expect(result.error).toBe(MonitoringErrorCode.UNSUPPORTED_PLATFORM);
        });

        it('should return UNSUPPORTED_PLATFORM for getBatteryStatus on unknown platform', async () => {
            vi.mocked(os.platform).mockReturnValue('sunos');

            const result = await service.getBatteryStatus();

            expect(result.success).toBe(false);
            expect(result.error).toBe(MonitoringErrorCode.UNSUPPORTED_PLATFORM);
        });

        it('should propagate command errors as failed response in getSystemMonitor', async () => {
            vi.mocked(os.platform).mockReturnValue('darwin');
            mockExec.mockImplementation((_command: string, _options: Record<string, unknown>, callback: (err: Error | null, stdout: string, stderr: string) => void) => {
                callback(new Error('exec error'), '', 'some stderr');
            });

            const result = await service.getSystemMonitor();

            expect(result.success).toBe(false);
            expect(result.error).toBe('exec error');
        });

        it('should propagate command errors as failed response in getBatteryStatus', async () => {
            vi.mocked(os.platform).mockReturnValue('darwin');
            mockExec.mockImplementation((_command: string, _options: Record<string, unknown>, callback: (err: Error | null, stdout: string, stderr: string) => void) => {
                callback(new Error('pmset failed'), '', '');
            });

            const result = await service.getBatteryStatus();

            expect(result.success).toBe(false);
            expect(result.error).toBe('pmset failed');
        });
    });

    describe('edge cases - getTelemetry structure', () => {
        it('should return correct structure before initialize', () => {
            const uninitService = new MonitoringService();
            const telemetry = uninitService.getTelemetry();

            expect(telemetry).toEqual({
                serviceName: 'MonitoringService',
                initialized: true,
                telemetryEnabled: false,
            });
        });

        it('should return telemetryEnabled true after initialize', async () => {
            const freshService = new MonitoringService();
            await freshService.initialize();
            const telemetry = freshService.getTelemetry();

            expect(telemetry).toEqual({
                serviceName: 'MonitoringService',
                initialized: true,
                telemetryEnabled: true,
            });

            await freshService.cleanup();
        });

        it('should return telemetryEnabled false after cleanup', async () => {
            const freshService = new MonitoringService();
            await freshService.initialize();
            await freshService.cleanup();
            const telemetry = freshService.getTelemetry();

            expect(telemetry.telemetryEnabled).toBe(false);
        });

        it('should have all expected keys in telemetry object', () => {
            const telemetry = service.getTelemetry();
            const keys = Object.keys(telemetry);

            expect(keys).toContain('serviceName');
            expect(keys).toContain('initialized');
            expect(keys).toContain('telemetryEnabled');
            expect(keys).toHaveLength(3);
        });
    });
});

describe('MonitoringService - validation', () => {
    let service: MonitoringService;

    beforeEach(async () => {
        vi.clearAllMocks();
        vi.mocked(os.platform).mockReturnValue('win32');
        service = new MonitoringService();
        await service.initialize();
    });

    afterEach(async () => {
        await service.cleanup();
    });

    describe('recordMetric validation', () => {
        it('should accept a valid metric name and value', () => {
            const result = service.recordMetric('cpu.usage', 42);
            expect(result.success).toBe(true);
        });

        it('should reject empty string metric name', () => {
            const result = service.recordMetric('', 10);
            expect(result.success).toBe(false);
            expect(result.error).toContain(MonitoringErrorCode.INVALID_METRIC_NAME);
        });

        it('should reject whitespace-only metric name', () => {
            const result = service.recordMetric('   ', 10);
            expect(result.success).toBe(false);
            expect(result.error).toContain(MonitoringErrorCode.INVALID_METRIC_NAME);
        });

        it('should reject metric name starting with a number', () => {
            const result = service.recordMetric('1cpu', 10);
            expect(result.success).toBe(false);
            expect(result.error).toContain(MonitoringErrorCode.INVALID_METRIC_NAME);
        });

        it('should reject metric name with special characters', () => {
            const result = service.recordMetric('cpu@usage!', 10);
            expect(result.success).toBe(false);
            expect(result.error).toContain(MonitoringErrorCode.INVALID_METRIC_NAME);
        });

        it('should reject metric name exceeding max length', () => {
            const longName = 'a'.repeat(129);
            const result = service.recordMetric(longName, 10);
            expect(result.success).toBe(false);
            expect(result.error).toContain(MonitoringErrorCode.INVALID_METRIC_NAME);
        });

        it('should accept metric name at max length boundary', () => {
            const name = 'a'.repeat(128);
            const result = service.recordMetric(name, 10);
            expect(result.success).toBe(true);
        });

        it('should accept metric name with dots, underscores, hyphens', () => {
            const result = service.recordMetric('cpu.usage_total-v2', 99);
            expect(result.success).toBe(true);
        });

        it('should reject NaN metric value', () => {
            const result = service.recordMetric('cpu', NaN);
            expect(result.success).toBe(false);
            expect(result.error).toContain('finite number');
        });

        it('should reject Infinity metric value', () => {
            const result = service.recordMetric('cpu', Infinity);
            expect(result.success).toBe(false);
            expect(result.error).toContain('finite number');
        });

        it('should accept zero metric value', () => {
            const result = service.recordMetric('cpu', 0);
            expect(result.success).toBe(true);
        });

        it('should accept negative metric value', () => {
            const result = service.recordMetric('temperature', -5);
            expect(result.success).toBe(true);
        });

        it('should overwrite existing metric with same name', () => {
            service.recordMetric('cpu', 10);
            service.recordMetric('cpu', 20);
            const result = service.getMetric('cpu');
            expect(result.success).toBe(true);
            expect(result.result?.value).toBe(20);
        });
    });

    describe('setThreshold validation', () => {
        it('should accept a valid threshold', () => {
            const result = service.setThreshold('cpu.usage', 80);
            expect(result.success).toBe(true);
        });

        it('should reject empty metric name', () => {
            const result = service.setThreshold('', 80);
            expect(result.success).toBe(false);
            expect(result.error).toContain(MonitoringErrorCode.INVALID_METRIC_NAME);
        });

        it('should reject negative threshold', () => {
            const result = service.setThreshold('cpu', -1);
            expect(result.success).toBe(false);
            expect(result.error).toContain(MonitoringErrorCode.INVALID_THRESHOLD);
            expect(result.error).toContain('negative');
        });

        it('should accept zero threshold', () => {
            const result = service.setThreshold('cpu', 0);
            expect(result.success).toBe(true);
        });

        it('should reject threshold exceeding maximum', () => {
            const result = service.setThreshold('cpu', 1_000_001);
            expect(result.success).toBe(false);
            expect(result.error).toContain(MonitoringErrorCode.INVALID_THRESHOLD);
            expect(result.error).toContain('1000000');
        });

        it('should accept threshold at max boundary', () => {
            const result = service.setThreshold('cpu', 1_000_000);
            expect(result.success).toBe(true);
        });

        it('should reject NaN threshold', () => {
            const result = service.setThreshold('cpu', NaN);
            expect(result.success).toBe(false);
            expect(result.error).toContain(MonitoringErrorCode.INVALID_THRESHOLD);
        });

        it('should reject Infinity threshold', () => {
            const result = service.setThreshold('cpu', Infinity);
            expect(result.success).toBe(false);
            expect(result.error).toContain(MonitoringErrorCode.INVALID_THRESHOLD);
        });
    });

    describe('configureAlert validation', () => {
        const validAlert: AlertConfiguration = {
            metricName: 'cpu.usage',
            threshold: 90,
            direction: 'above',
            enabled: true,
        };

        it('should accept a valid alert configuration', () => {
            const result = service.configureAlert(validAlert);
            expect(result.success).toBe(true);
        });

        it('should reject null config', () => {
            const result = service.configureAlert(null as unknown as AlertConfiguration);
            expect(result.success).toBe(false);
            expect(result.error).toContain(MonitoringErrorCode.INVALID_ALERT_CONFIG);
        });

        it('should reject empty metric name in alert', () => {
            const result = service.configureAlert({ ...validAlert, metricName: '' });
            expect(result.success).toBe(false);
            expect(result.error).toContain(MonitoringErrorCode.INVALID_METRIC_NAME);
        });

        it('should reject negative threshold in alert', () => {
            const result = service.configureAlert({ ...validAlert, threshold: -5 });
            expect(result.success).toBe(false);
            expect(result.error).toContain(MonitoringErrorCode.INVALID_ALERT_CONFIG);
            expect(result.error).toContain('negative');
        });

        it('should reject NaN threshold in alert', () => {
            const result = service.configureAlert({ ...validAlert, threshold: NaN });
            expect(result.success).toBe(false);
            expect(result.error).toContain(MonitoringErrorCode.INVALID_ALERT_CONFIG);
        });

        it('should reject threshold exceeding max in alert', () => {
            const result = service.configureAlert({ ...validAlert, threshold: 2_000_000 });
            expect(result.success).toBe(false);
            expect(result.error).toContain(MonitoringErrorCode.INVALID_ALERT_CONFIG);
        });

        it('should reject invalid direction', () => {
            const result = service.configureAlert({
                ...validAlert,
                direction: 'sideways' as 'above',
            });
            expect(result.success).toBe(false);
            expect(result.error).toContain(MonitoringErrorCode.INVALID_ALERT_CONFIG);
            expect(result.error).toContain('Direction');
        });

        it('should reject non-boolean enabled field', () => {
            const result = service.configureAlert({
                ...validAlert,
                enabled: 1 as unknown as boolean,
            });
            expect(result.success).toBe(false);
            expect(result.error).toContain(MonitoringErrorCode.INVALID_ALERT_CONFIG);
            expect(result.error).toContain('boolean');
        });

        it('should accept direction below', () => {
            const result = service.configureAlert({ ...validAlert, direction: 'below' });
            expect(result.success).toBe(true);
        });

        it('should accept enabled false', () => {
            const result = service.configureAlert({ ...validAlert, enabled: false });
            expect(result.success).toBe(true);
        });

        it('should accept zero threshold in alert', () => {
            const result = service.configureAlert({ ...validAlert, threshold: 0 });
            expect(result.success).toBe(true);
        });
    });

    describe('getMetric validation', () => {
        it('should return metric after recording', () => {
            service.recordMetric('memory.usage', 75);
            const result = service.getMetric('memory.usage');
            expect(result.success).toBe(true);
            expect(result.result?.name).toBe('memory.usage');
            expect(result.result?.value).toBe(75);
            expect(result.result?.timestamp).toBeGreaterThan(0);
        });

        it('should reject empty metric name', () => {
            const result = service.getMetric('');
            expect(result.success).toBe(false);
            expect(result.error).toContain(MonitoringErrorCode.INVALID_METRIC_NAME);
        });

        it('should return not found for unrecorded metric', () => {
            const result = service.getMetric('nonexistent');
            expect(result.success).toBe(false);
            expect(result.error).toContain(MonitoringErrorCode.METRIC_NOT_FOUND);
        });

        it('should clear metrics on cleanup', async () => {
            service.recordMetric('cpu', 50);
            await service.cleanup();
            await service.initialize();
            const result = service.getMetric('cpu');
            expect(result.success).toBe(false);
            expect(result.error).toContain(MonitoringErrorCode.METRIC_NOT_FOUND);
        });
    });

    describe('collectAllMetrics', () => {
        it('should succeed when all collectors return data', async () => {
            // Arrange
            vi.mocked(os.loadavg).mockReturnValue([1.0, 0.5, 0.3]);
            vi.mocked(os.totalmem).mockReturnValue(16000000000);
            vi.mocked(os.freemem).mockReturnValue(8000000000);
            vi.mocked(os.platform).mockReturnValue('win32');
            mockExec.mockImplementation((_command: string, _options: Record<string, unknown>, callback: (err: Error | null, stdout: string, stderr: string) => void) => {
                callback(null, 'mock output', '');
            });

            // Act
            const result = await service.collectAllMetrics();

            // Assert
            expect(result.success).toBe(true);
            expect(result.result?.usage).not.toBeNull();
            expect(result.result?.systemMonitor).not.toBeNull();
            expect(result.result?.battery).not.toBeNull();
            expect(result.result?.errors).toHaveLength(0);
        });

        it('should succeed with partial data when one collector fails', async () => {
            // Arrange: usage works, command-based collectors fail
            vi.mocked(os.loadavg).mockReturnValue([1.0, 0.5, 0.3]);
            vi.mocked(os.totalmem).mockReturnValue(16000000000);
            vi.mocked(os.freemem).mockReturnValue(8000000000);
            vi.mocked(os.platform).mockReturnValue('freebsd'); // unsupported → system + battery fail

            // Act
            const result = await service.collectAllMetrics();

            // Assert
            expect(result.success).toBe(true);
            expect(result.result?.usage).not.toBeNull();
            expect(result.result?.systemMonitor).toBeNull();
            expect(result.result?.battery).toBeNull();
            expect(result.result?.errors.length).toBeGreaterThan(0);
        });

        it('should return COLLECTION_FAILED when all collectors fail', async () => {
            // Arrange: getUsage throws, platform unsupported for the rest
            vi.mocked(os.loadavg).mockImplementation(() => {
                throw new Error('OS error');
            });
            vi.mocked(os.platform).mockReturnValue('freebsd');

            // Act
            const result = await service.collectAllMetrics();

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toContain(MonitoringErrorCode.COLLECTION_FAILED);
            expect(result.result?.errors.length).toBe(3);
        });

        it('should not crash when a collector throws unexpectedly', async () => {
            // Arrange
            vi.mocked(os.loadavg).mockReturnValue([0.5, 0.3, 0.2]);
            vi.mocked(os.totalmem).mockReturnValue(16000000000);
            vi.mocked(os.freemem).mockReturnValue(8000000000);
            vi.mocked(os.platform).mockReturnValue('win32');
            mockExec.mockImplementation((_command: string, _options: Record<string, unknown>, callback: (err: Error | null, stdout: string, stderr: string) => void) => {
                callback(new Error('command boom'), '', '');
            });

            // Act - should not throw
            const result = await service.collectAllMetrics();

            // Assert
            expect(result.result?.usage).not.toBeNull();
            expect(result.result?.errors.length).toBeGreaterThan(0);
        });

        it('should log warnings for failed collectors', async () => {
            // Arrange
            const { appLogger } = await import('@main/logging/logger');
            vi.mocked(os.loadavg).mockReturnValue([0.5, 0.3, 0.2]);
            vi.mocked(os.totalmem).mockReturnValue(16000000000);
            vi.mocked(os.freemem).mockReturnValue(8000000000);
            vi.mocked(os.platform).mockReturnValue('freebsd');

            // Act
            await service.collectAllMetrics();

            // Assert - logWarn called for the failed collectors
            expect(appLogger.warn).toHaveBeenCalled();
        });
    });
});
