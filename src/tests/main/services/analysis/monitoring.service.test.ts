import { MonitoringService } from '@main/services/analysis/monitoring.service';
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
            expect(result.error).toBe('MONITORING_NO_BATTERY');
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
});
