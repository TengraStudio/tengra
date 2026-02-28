import { exec } from 'child_process';
import * as os from 'os';

import { appLogger } from '@main/logging/logger';
import { BaseService } from '@main/services/base.service';
import { withRetry } from '@main/utils/retry.util';
import { ServiceResponse } from '@shared/types';
import { getErrorMessage } from '@shared/utils/error.util';

/**
 * Standardized error codes for MonitoringService
 */
export enum MonitoringErrorCode {
    UNSUPPORTED_PLATFORM = 'MONITORING_UNSUPPORTED_PLATFORM',
    COMMAND_TIMEOUT = 'MONITORING_COMMAND_TIMEOUT',
    COMMAND_FAILED = 'MONITORING_COMMAND_FAILED',
    OUTPUT_TRUNCATED = 'MONITORING_OUTPUT_TRUNCATED',
    INVALID_METRIC_NAME = 'MONITORING_INVALID_METRIC_NAME',
    INVALID_THRESHOLD = 'MONITORING_INVALID_THRESHOLD',
    INVALID_ALERT_CONFIG = 'MONITORING_INVALID_ALERT_CONFIG',
    METRIC_NOT_FOUND = 'MONITORING_METRIC_NOT_FOUND',
    NO_BATTERY = 'MONITORING_NO_BATTERY',
    COLLECTION_FAILED = 'MONITORING_COLLECTION_FAILED'
}

/** Configuration for a metric alert */
export interface AlertConfiguration {
    metricName: string;
    threshold: number;
    direction: 'above' | 'below';
    enabled: boolean;
}

/** Stored metric entry */
export interface MetricEntry {
    name: string;
    value: number;
    timestamp: number;
}

/** Maximum length for a metric name */
const MAX_METRIC_NAME_LENGTH = 128;

/** Maximum allowed threshold value */
const MAX_THRESHOLD_VALUE = 1_000_000;

/** Maximum number of stored metrics */
const MAX_METRICS_COUNT = 1000;

/** Default retry attempts for transient command failures */
const DEFAULT_RETRY_COUNT = 2;

/** Base delay (ms) between retries */
const DEFAULT_RETRY_BASE_DELAY_MS = 500;

/** Pattern for valid metric names: starts with letter, allows alphanumeric, dots, underscores, hyphens */
const METRIC_NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9._-]*$/;

/**
 * Telemetry events emitted by MonitoringService
 */
export enum MonitoringTelemetryEvent {
    USAGE_CHECKED = 'monitoring_usage_checked',
    SYSTEM_MONITOR_CHECKED = 'monitoring_system_monitor_checked',
    BATTERY_CHECKED = 'monitoring_battery_checked',
    COMMAND_TIMEOUT = 'monitoring_command_timeout',
    COMMAND_FAILED = 'monitoring_command_failed'
}

/**
 * Performance budgets (in ms) for MonitoringService operations
 */
export const MONITORING_PERFORMANCE_BUDGETS = {
    GET_USAGE_MS: 100,
    GET_SYSTEM_MONITOR_MS: 6000,
    GET_BATTERY_STATUS_MS: 6000,
    COLLECT_ALL_METRICS_MS: 15000,
    INITIALIZE_MS: 100,
    CLEANUP_MS: 100
} as const;

/**
 * MonitoringService provides system monitoring capabilities including CPU, memory, battery status.
 * This service uses OS-level commands to gather system metrics.
 */
export class MonitoringService extends BaseService {
    private readonly maxCommandOutputSize = 1024 * 1024; // 1MB max output
    private readonly commandTimeout = 5000; // 5 second timeout
    private telemetryEnabled = false;
    private readonly metrics = new Map<string, MetricEntry>();
    private readonly thresholds = new Map<string, number>();
    private readonly alerts = new Map<string, AlertConfiguration>();

    constructor() {
        super('MonitoringService');
    }

    /**
     * Initialize the MonitoringService
     */
    async initialize(): Promise<void> {
        const start = performance.now();
        appLogger.info(this.name, 'Initializing monitoring service...');
        this.telemetryEnabled = true;
        appLogger.info(this.name, 'Monitoring service initialized');
        this.warnIfOverBudget('initialize', start, MONITORING_PERFORMANCE_BUDGETS.INITIALIZE_MS);
    }

    /**
     * Cleanup the MonitoringService
     */
    async cleanup(): Promise<void> {
        const start = performance.now();
        appLogger.info(this.name, 'Cleaning up monitoring service...');
        this.telemetryEnabled = false;
        this.metrics.clear();
        this.thresholds.clear();
        this.alerts.clear();
        appLogger.info(this.name, 'Monitoring service cleaned up');
        this.warnIfOverBudget('cleanup', start, MONITORING_PERFORMANCE_BUDGETS.CLEANUP_MS);
    }

    /**
     * Get current CPU and memory usage statistics.
     * @returns ServiceResponse with cpu and memory usage percentages
     */
    async getUsage(): Promise<ServiceResponse<{ cpu: number; memory: number }>> {
        const start = performance.now();
        try {
            const cpuUsage = os.loadavg()[0]; // 1 minute average
            const totalMem = os.totalmem();
            const freeMem = os.freemem();
            const memUsage = totalMem > 0 ? ((totalMem - freeMem) / totalMem) * 100 : 0;

            this.logDebug('getUsage completed', { cpu: cpuUsage, memory: memUsage });
            this.emitTelemetry(MonitoringTelemetryEvent.USAGE_CHECKED, { cpu: cpuUsage, memory: memUsage });

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
        } finally {
            this.warnIfOverBudget('getUsage', start, MONITORING_PERFORMANCE_BUDGETS.GET_USAGE_MS);
        }
    }

    /**
     * Get detailed system monitor output using platform-specific commands.
     * @returns ServiceResponse with command output
     */
    async getSystemMonitor(): Promise<ServiceResponse<{ output: string }>> {
        const start = performance.now();
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
                return { success: false, error: MonitoringErrorCode.UNSUPPORTED_PLATFORM };
            }

            // Validate output size to prevent buffer overflow
            if (output.length > this.maxCommandOutputSize) {
                output = output.substring(0, this.maxCommandOutputSize);
                this.logWarn('getSystemMonitor output truncated', { originalLength: output.length });
            }

            this.logDebug('getSystemMonitor completed', { platform: os.platform() });
            this.emitTelemetry(MonitoringTelemetryEvent.SYSTEM_MONITOR_CHECKED, { platform: os.platform() });

            return { success: true, result: { output } };
        } catch (error) {
            const errorMessage = getErrorMessage(error);
            this.logError('getSystemMonitor failed', error);
            this.emitTelemetry(MonitoringTelemetryEvent.COMMAND_FAILED, { method: 'getSystemMonitor', error: errorMessage });
            return { success: false, error: errorMessage };
        } finally {
            this.warnIfOverBudget('getSystemMonitor', start, MONITORING_PERFORMANCE_BUDGETS.GET_SYSTEM_MONITOR_MS);
        }
    }

    /**
     * Get battery status for the current platform.
     * @returns ServiceResponse with battery information
     */
    async getBatteryStatus(): Promise<ServiceResponse<{ output: string }>> {
        const start = performance.now();
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
                    return { success: false, error: MonitoringErrorCode.NO_BATTERY };
                }
            } else if (platform === 'darwin') {
                const { stdout } = await this.executeWithTimeout(
                    'pmset -g batt',
                    this.commandTimeout
                );
                output = stdout;
            } else {
                return { success: false, error: MonitoringErrorCode.UNSUPPORTED_PLATFORM };
            }

            // Validate output size
            if (output.length > this.maxCommandOutputSize) {
                output = output.substring(0, this.maxCommandOutputSize);
            }

            this.logDebug('getBatteryStatus completed', { platform: os.platform() });
            this.emitTelemetry(MonitoringTelemetryEvent.BATTERY_CHECKED, { platform: os.platform() });

            return { success: true, result: { output } };
        } catch (error) {
            const errorMessage = getErrorMessage(error);
            this.logError('getBatteryStatus failed', error);
            this.emitTelemetry(MonitoringTelemetryEvent.COMMAND_FAILED, { method: 'getBatteryStatus', error: errorMessage });
            return { success: false, error: errorMessage };
        } finally {
            this.warnIfOverBudget('getBatteryStatus', start, MONITORING_PERFORMANCE_BUDGETS.GET_BATTERY_STATUS_MS);
        }
    }

    /**
     * Record a named metric value.
     * @param name - Metric name (alphanumeric, dots, underscores, hyphens; starts with letter)
     * @param value - Metric value (must be a finite number)
     */
    recordMetric(name: string, value: number): ServiceResponse<void> {
        const nameValidation = this.validateMetricName(name);
        if (!nameValidation.valid) {
            return { success: false, error: nameValidation.error };
        }

        if (typeof value !== 'number' || !Number.isFinite(value)) {
            return { success: false, error: 'Metric value must be a finite number' };
        }

        if (this.metrics.size >= MAX_METRICS_COUNT && !this.metrics.has(name)) {
            return { success: false, error: `Maximum number of metrics (${MAX_METRICS_COUNT}) reached` };
        }

        this.metrics.set(name, { name, value, timestamp: Date.now() });
        this.logDebug('recordMetric', { name, value });
        return { success: true };
    }

    /**
     * Set a threshold for a named metric.
     * @param metricName - The metric name to set a threshold for
     * @param threshold - Threshold value (must be non-negative and finite)
     */
    setThreshold(metricName: string, threshold: number): ServiceResponse<void> {
        const nameValidation = this.validateMetricName(metricName);
        if (!nameValidation.valid) {
            return { success: false, error: nameValidation.error };
        }

        if (typeof threshold !== 'number' || !Number.isFinite(threshold)) {
            return {
                success: false,
                error: `${MonitoringErrorCode.INVALID_THRESHOLD}: Threshold must be a finite number`,
            };
        }

        if (threshold < 0) {
            return {
                success: false,
                error: `${MonitoringErrorCode.INVALID_THRESHOLD}: Threshold must not be negative, got ${threshold}`,
            };
        }

        if (threshold > MAX_THRESHOLD_VALUE) {
            return {
                success: false,
                error: `${MonitoringErrorCode.INVALID_THRESHOLD}: Threshold must not exceed ${MAX_THRESHOLD_VALUE}, got ${threshold}`,
            };
        }

        this.thresholds.set(metricName, threshold);
        this.logDebug('setThreshold', { metricName, threshold });
        return { success: true };
    }

    /**
     * Configure an alert for a metric.
     * @param config - Alert configuration object
     */
    configureAlert(config: AlertConfiguration): ServiceResponse<void> {
        if (!config || typeof config !== 'object') {
            return {
                success: false,
                error: `${MonitoringErrorCode.INVALID_ALERT_CONFIG}: Configuration must be a non-null object`,
            };
        }

        const nameValidation = this.validateMetricName(config.metricName);
        if (!nameValidation.valid) {
            return { success: false, error: nameValidation.error };
        }

        if (typeof config.threshold !== 'number' || !Number.isFinite(config.threshold)) {
            return {
                success: false,
                error: `${MonitoringErrorCode.INVALID_ALERT_CONFIG}: Alert threshold must be a finite number`,
            };
        }

        if (config.threshold < 0) {
            return {
                success: false,
                error: `${MonitoringErrorCode.INVALID_ALERT_CONFIG}: Alert threshold must not be negative`,
            };
        }

        if (config.threshold > MAX_THRESHOLD_VALUE) {
            return {
                success: false,
                error: `${MonitoringErrorCode.INVALID_ALERT_CONFIG}: Alert threshold must not exceed ${MAX_THRESHOLD_VALUE}`,
            };
        }

        if (config.direction !== 'above' && config.direction !== 'below') {
            return {
                success: false,
                error: `${MonitoringErrorCode.INVALID_ALERT_CONFIG}: Direction must be 'above' or 'below'`,
            };
        }

        if (typeof config.enabled !== 'boolean') {
            return {
                success: false,
                error: `${MonitoringErrorCode.INVALID_ALERT_CONFIG}: Enabled must be a boolean`,
            };
        }

        this.alerts.set(config.metricName, { ...config });
        this.logDebug('configureAlert', { metricName: config.metricName, direction: config.direction });
        return { success: true };
    }

    /**
     * Get a recorded metric by name.
     * @param name - The metric name to look up
     */
    getMetric(name: string): ServiceResponse<MetricEntry> {
        const nameValidation = this.validateMetricName(name);
        if (!nameValidation.valid) {
            return { success: false, error: nameValidation.error };
        }

        const entry = this.metrics.get(name);
        if (!entry) {
            return {
                success: false,
                error: `${MonitoringErrorCode.METRIC_NOT_FOUND}: No metric found with name '${name}'`,
            };
        }

        return { success: true, result: { ...entry } };
    }

    /**
     * Collect all system metrics in one call. Each metric is collected independently;
     * failures are logged and skipped so one bad collector never crashes the batch.
     * @returns ServiceResponse with partial results and any errors encountered
     */
    async collectAllMetrics(): Promise<
        ServiceResponse<{
            usage: { cpu: number; memory: number } | null;
            systemMonitor: { output: string } | null;
            battery: { output: string } | null;
            errors: string[];
        }>
    > {
        const start = performance.now();
        const errors: string[] = [];

        const usage = await this.safeCollect('usage', () => this.getUsage(), errors);
        const systemMonitor = await this.safeCollect('systemMonitor', () => this.getSystemMonitor(), errors);
        const battery = await this.safeCollect('battery', () => this.getBatteryStatus(), errors);

        const hasAnyData = usage !== null || systemMonitor !== null || battery !== null;
        this.warnIfOverBudget('collectAllMetrics', start, MONITORING_PERFORMANCE_BUDGETS.COLLECT_ALL_METRICS_MS);

        if (!hasAnyData) {
            return {
                success: false,
                error: `${MonitoringErrorCode.COLLECTION_FAILED}: All metric collectors failed`,
                result: { usage, systemMonitor, battery, errors },
            };
        }

        return {
            success: true,
            result: { usage, systemMonitor, battery, errors },
        };
    }

    /**
     * Safely collect a single metric category, catching and logging failures.
     */
    private async safeCollect<T>(
        label: string,
        fn: () => Promise<ServiceResponse<T>>,
        errors: string[]
    ): Promise<T | null> {
        try {
            const response = await fn();
            if (response.success && response.result) {
                return response.result;
            }
            const msg = response.error ?? 'Unknown failure';
            this.logWarn(`collectAllMetrics: ${label} returned failure`, { error: msg });
            errors.push(`${label}: ${msg}`);
            return null;
        } catch (error) {
            const msg = getErrorMessage(error);
            this.logError(`collectAllMetrics: ${label} threw`, error);
            errors.push(`${label}: ${msg}`);
            return null;
        }
    }

    /**
     * Log a warning if the elapsed time exceeds the given budget.
     * @param method - Name of the method being measured
     * @param startTime - Start timestamp from performance.now()
     * @param budgetMs - Budget in milliseconds
     */
    private warnIfOverBudget(method: string, startTime: number, budgetMs: number): void {
        const elapsed = performance.now() - startTime;
        if (elapsed > budgetMs) {
            this.logWarn(`Performance budget exceeded for ${method}`, {
                elapsedMs: Math.round(elapsed),
                budgetMs,
            });
        }
    }

    /**
     * Validate a metric name against naming rules.
     */
    private validateMetricName(name: string): { valid: true } | { valid: false; error: string } {
        if (typeof name !== 'string' || name.trim().length === 0) {
            return {
                valid: false,
                error: `${MonitoringErrorCode.INVALID_METRIC_NAME}: Metric name must be a non-empty string`,
            };
        }

        if (name.length > MAX_METRIC_NAME_LENGTH) {
            return {
                valid: false,
                error: `${MonitoringErrorCode.INVALID_METRIC_NAME}: Metric name must not exceed ${MAX_METRIC_NAME_LENGTH} characters`,
            };
        }

        if (!METRIC_NAME_PATTERN.test(name)) {
            return {
                valid: false,
                error: `${MonitoringErrorCode.INVALID_METRIC_NAME}: Metric name must start with a letter and contain only alphanumeric characters, dots, underscores, or hyphens`,
            };
        }

        return { valid: true };
    }

    /**
     * Execute a command with timeout, retrying on transient failures.
     */
    private async executeWithTimeout(
        command: string,
        timeoutMs: number
    ): Promise<{ stdout: string; stderr: string }> {
        if (!command || typeof command !== 'string' || command.trim().length === 0) {
            throw new Error('Command must be a non-empty string');
        }

        if (!timeoutMs || timeoutMs <= 0 || timeoutMs > 30000) {
            throw new Error('Timeout must be between 1 and 30000ms');
        }

        return withRetry(
            () => this.runCommand(command, timeoutMs),
            {
                maxRetries: DEFAULT_RETRY_COUNT,
                baseDelayMs: DEFAULT_RETRY_BASE_DELAY_MS,
                onRetry: (_err, attempt, delay) => {
                    this.emitTelemetry(MonitoringTelemetryEvent.COMMAND_TIMEOUT, {
                        command: command.substring(0, 50),
                        attempt,
                    });
                    this.logWarn('executeWithTimeout retrying', {
                        command: command.substring(0, 50),
                        attempt,
                        delayMs: delay,
                    });
                },
            }
        );
    }

    /**
     * Run a single command with a timeout guard.
     */
    private runCommand(
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

    /**
     * Emit a telemetry event when telemetry is enabled.
     * @param event - The telemetry event name
     * @param metadata - Optional metadata for the event
     */
    private emitTelemetry(event: MonitoringTelemetryEvent, metadata?: Record<string, unknown>): void {
        if (!this.telemetryEnabled) {
            return;
        }
        appLogger.info(this.name, `Telemetry: ${event}`, metadata);
    }
}
