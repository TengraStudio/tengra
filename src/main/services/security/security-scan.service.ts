import { execFile } from 'child_process';
import * as path from 'path';

import { BaseService } from '@main/services/base.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { JobSchedulerService } from '@main/services/system/job-scheduler.service';
import { getErrorMessage } from '@shared/utils/error.util';
import { app } from 'electron';

/** Vulnerability counts by severity level. */
export interface VulnerabilityCounts {
    critical: number
    high: number
    moderate: number
    low: number
    info: number
    total: number
}

/** Result of a security scan. */
export interface SecurityScanResult {
    timestamp: number
    vulnerabilities: VulnerabilityCounts
    success: boolean
    errorMessage?: string
}

/** Parsed npm audit JSON metadata. */
interface NpmAuditMetadata {
    vulnerabilities?: Record<string, { severity?: string }>
}

/** Top-level npm audit JSON output structure. */
interface NpmAuditOutput {
    metadata?: {
        vulnerabilities?: {
            critical?: number
            high?: number
            moderate?: number
            low?: number
            info?: number
            total?: number
        }
    }
    vulnerabilities?: Record<string, { severity?: string }>
}

const SCAN_JOB_ID = 'security-scan-npm-audit';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const EXEC_TIMEOUT_MS = 60_000;

/**
 * Periodically runs `npm audit --json` to detect node_modules vulnerabilities.
 * Stores the latest scan result and emits events for critical/high findings.
 */
export class SecurityScanService extends BaseService {
    private latestResult: SecurityScanResult | null = null;

    constructor(
        private readonly eventBus: EventBusService,
        private readonly jobScheduler: JobSchedulerService
    ) {
        super('SecurityScanService');
    }

    /** Initializes the service and registers the periodic scan job. */
    async initialize(): Promise<void> {
        this.logInfo('Registering periodic npm audit scan');
        this.jobScheduler.registerRecurringJob(
            SCAN_JOB_ID,
            async () => { await this.runScan(); },
            () => ONE_DAY_MS
        );
    }

    /** Returns the most recent scan result, or null if no scan has completed yet. */
    getLatestResult(): SecurityScanResult | null {
        return this.latestResult;
    }

    /** Executes an npm audit scan and stores the result. */
    async runScan(): Promise<SecurityScanResult> {
        this.logInfo('Starting npm audit scan');
        try {
            const output = await this.executeNpmAudit();
            const counts = this.parseAuditOutput(output);
            const result: SecurityScanResult = {
                timestamp: Date.now(),
                vulnerabilities: counts,
                success: true,
            };
            this.latestResult = result;
            this.logInfo('Scan completed', {
                critical: counts.critical,
                high: counts.high,
                moderate: counts.moderate,
                low: counts.low,
                total: counts.total,
            });
            if (counts.critical > 0 || counts.high > 0) {
                this.eventBus.emitCustom('security:vulnerabilities-found', {
                    critical: counts.critical,
                    high: counts.high,
                    timestamp: result.timestamp,
                });
                this.logWarn('Critical/high vulnerabilities detected', {
                    critical: counts.critical,
                    high: counts.high,
                });
            }
            return result;
        } catch (error) {
            const msg = getErrorMessage(error);
            const failResult: SecurityScanResult = {
                timestamp: Date.now(),
                vulnerabilities: { critical: 0, high: 0, moderate: 0, low: 0, info: 0, total: 0 },
                success: false,
                errorMessage: msg,
            };
            this.latestResult = failResult;
            this.logError('npm audit scan failed', error as Error);
            return failResult;
        }
    }

    /** Cleans up resources on shutdown. */
    async cleanup(): Promise<void> {
        this.logInfo('Cleaning up');
    }

    /**
     * Runs `npm audit --json` in the application root and returns stdout.
     * npm audit exits with non-zero when vulnerabilities exist, so we
     * treat both zero and non-zero exits as valid if stdout is present.
     */
    private executeNpmAudit(): Promise<string> {
        return new Promise((resolve, reject) => {
            const appRoot = app.isPackaged
                ? path.dirname(app.getAppPath())
                : path.resolve(__dirname, '..', '..', '..');

            execFile(
                'npm',
                ['audit', '--json'],
                { cwd: appRoot, timeout: EXEC_TIMEOUT_MS, shell: false, maxBuffer: 5 * 1024 * 1024 },
                (error, stdout, _stderr) => {
                    // npm audit returns exit code 1 when vulnerabilities exist
                    if (stdout && stdout.trim().length > 0) {
                        resolve(stdout);
                        return;
                    }
                    reject(error ?? new Error('npm audit produced no output'));
                }
            );
        });
    }

    /** Parses npm audit JSON output into vulnerability counts. */
    private parseAuditOutput(raw: string): VulnerabilityCounts {
        const defaults: VulnerabilityCounts = { critical: 0, high: 0, moderate: 0, low: 0, info: 0, total: 0 };
        let parsed: NpmAuditOutput;
        try {
            parsed = JSON.parse(raw) as NpmAuditOutput;
        } catch {
            this.logWarn('Failed to parse npm audit JSON output');
            return defaults;
        }

        // npm audit v2+ format: metadata.vulnerabilities has counts by severity
        const meta = parsed.metadata?.vulnerabilities;
        if (meta) {
            return {
                critical: meta.critical ?? 0,
                high: meta.high ?? 0,
                moderate: meta.moderate ?? 0,
                low: meta.low ?? 0,
                info: meta.info ?? 0,
                total: meta.total ?? 0,
            };
        }

        // Fallback: count from vulnerabilities map
        return this.countFromVulnerabilities(parsed.vulnerabilities);
    }

    /** Counts severity levels from the vulnerabilities record (npm audit v7+ format). */
    private countFromVulnerabilities(vulns?: NpmAuditMetadata['vulnerabilities']): VulnerabilityCounts {
        const counts: VulnerabilityCounts = { critical: 0, high: 0, moderate: 0, low: 0, info: 0, total: 0 };
        if (!vulns) {return counts;}

        for (const key of Object.keys(vulns)) {
            const severity = vulns[key]?.severity ?? 'info';
            if (severity in counts && severity !== 'total') {
                counts[severity as keyof Omit<VulnerabilityCounts, 'total'>] += 1;
            }
            counts.total += 1;
        }
        return counts;
    }
}
