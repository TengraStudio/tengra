import { exec } from 'child_process';
import * as os from 'os';

import { appLogger } from '@main/logging/logger';
import { BaseService } from '@main/services/base.service';
import { ServiceResponse } from '@shared/types';
import { getErrorMessage } from '@shared/utils/error.util';


/**
 * MonitoringService provides system monitoring capabilities including CPU, memory, battery status.
 * This service uses OS-level commands to gather system metrics.
 */
export class MonitoringService extends BaseService {
    private readonly maxCommandOutputSize = 1024 * 1024; // 1MB max output
    private readonly commandTimeout = 5000; // 5 second timeout
    private telemetryEnabled = false;

    constructor() {
        super('MonitoringService');
    }

    /**
     * Initialize the MonitoringService
     */
    async initialize(): Promise<void> {
        appLogger.info(this.name, 'Initializing monitoring service...');
        this.telemetryEnabled = true;
        appLogger.info(this.name, 'Monitoring service initialized');
    }

    /**
     * Cleanup the MonitoringService
     */
    async cleanup(): Promise<void> {
        appLogger.info(this.name, 'Cleaning up monitoring service...');
        this.telemetryEnabled = false;
        appLogger.info(this.name, 'Monitoring service cleaned up');
    }

    /**
     * Get current CPU and memory usage statistics.
     * @returns ServiceResponse with cpu and memory usage percentages
     */
    async getUsage(): Promise<ServiceResponse<{ cpu: number; memory: number }>> {
        try {
            const cpuUsage = os.loadavg()[0]; // 1 minute average
            const totalMem = os.totalmem();
            const freeMem = os.freemem();
            const memUsage = totalMem > 0 ? ((totalMem - freeMem) / totalMem) * 100 : 0;

            this.logDebug('getUsage completed', { cpu: cpuUsage, memory: memUsage });

            return {
                success: true,
                result: {
                    cpu: cpuUsage,
                    memory: memUsage,
                },
            };
        } catch (error) {
            this.logError('getUsage failed', error);
            return {
                success: false,
                error: getErrorMessage(error),
            };
        }
    }

    /**
     * Get detailed system monitor output using platform-specific commands.
     * @returns ServiceResponse with command output
     */
    async getSystemMonitor(): Promise<ServiceResponse<{ output: string }>> {
        try {
            let output = '';
            const platform = os.platform();
            if (platform === 'win32') {
                const { stdout } = await this.executeWithTimeout(
                    'wmic cpu get loadpercentage /value',
                    this.commandTimeout
                );
                output = stdout;
            } else if (platform === 'linux') {
                const { stdout } = await this.executeWithTimeout(
                    'top -bn1 | grep "Cpu(s)"',
                    this.commandTimeout
                );
                output = stdout;
            } else if (platform === 'darwin') {
                const { stdout } = await this.executeWithTimeout(
                    'top -l 1 -n 0',
                    this.commandTimeout
                );
                output = stdout;
            } else {
                return { success: false, error: 'MONITORING_UNSUPPORTED_PLATFORM' };
            }

            // Validate output size to prevent buffer overflow
            if (output.length > this.maxCommandOutputSize) {
                output = output.substring(0, this.maxCommandOutputSize);
                this.logWarn('getSystemMonitor output truncated', { originalLength: output.length });
            }

            this.logDebug('getSystemMonitor completed', { platform: os.platform() });

            return { success: true, result: { output } };
        } catch (error) {
            const errorMessage = getErrorMessage(error);
            this.logError('getSystemMonitor failed', error);
            return { success: false, error: errorMessage };
        }
    }

    /**
     * Get battery status for the current platform.
     * @returns ServiceResponse with battery information
     */
    async getBatteryStatus(): Promise<ServiceResponse<{ output: string }>> {
        try {
            let output = '';
            const platform = os.platform();
            if (platform === 'win32') {
                const { stdout } = await this.executeWithTimeout(
                    'powershell -Command "Get-CimInstance -ClassName Win32_Battery | Select-Object -Property EstimatedChargeRemaining, BatteryStatus"',
                    this.commandTimeout
                );
                output = stdout;
            } else if (platform === 'linux') {
                const batteries = await this.executeWithTimeout('upower -e | grep battery', this.commandTimeout);
                if (batteries.stdout.trim()) {
                    const { stdout } = await this.executeWithTimeout(
                        `upower -i ${batteries.stdout.trim()}`,
                        this.commandTimeout
                    );
                    output = stdout;
                } else {
                    return { success: false, error: 'MONITORING_NO_BATTERY' };
                }
            } else if (platform === 'darwin') {
                const { stdout } = await this.executeWithTimeout(
                    'pmset -g batt',
                    this.commandTimeout
                );
                output = stdout;
            } else {
                return { success: false, error: 'MONITORING_UNSUPPORTED_PLATFORM' };
            }

            // Validate output size
            if (output.length > this.maxCommandOutputSize) {
                output = output.substring(0, this.maxCommandOutputSize);
            }

            this.logDebug('getBatteryStatus completed', { platform: os.platform() });

            return { success: true, result: { output } };
        } catch (error) {
            const errorMessage = getErrorMessage(error);
            this.logError('getBatteryStatus failed', error);
            return { success: false, error: errorMessage };
        }
    }

    /**
     * Execute a command with timeout and error handling.
     */
    private async executeWithTimeout(
        command: string,
        timeoutMs: number
    ): Promise<{ stdout: string; stderr: string }> {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error(`Command timed out after ${timeoutMs}ms`));
            }, timeoutMs);

            exec(command, { maxBuffer: this.maxCommandOutputSize }, (error, stdout, stderr) => {
                clearTimeout(timeout);
                if (error) {
                    reject(error);
                } else {
                    resolve({ stdout, stderr });
                }
            });
        });
    }

    /**
     * Get telemetry data for monitoring service health.
     */
    getTelemetry(): { serviceName: string; initialized: boolean; telemetryEnabled: boolean } {
        return {
            serviceName: this.name,
            initialized: true,
            telemetryEnabled: this.telemetryEnabled,
        };
    }
}
