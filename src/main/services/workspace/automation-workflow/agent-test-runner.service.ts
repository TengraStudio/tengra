/**
 * Agent Test Runner Service
 * Handles test execution integration for agent tasks:
 * - AGT-TST-01: Auto-run tests after code changes
 * - AGT-TST-02: Test result parsing and visualization data
 * - AGT-TST-03: Step failure on test failure
 * - AGT-TST-04: Coverage tracking per plan
 */

import { spawn } from 'child_process';

import { appLogger } from '@main/logging/logger';
import { BaseService } from '@main/services/base.service';
import {
    StepTestConfig,
    TestCaseResult,
    TestCoverageResult,
    TestRunConfig,
    TestRunResult,
} from '@shared/types/automation-workflow';

/** Default test configurations by framework */
const FRAMEWORK_CONFIGS: Record<
    string,
    { command: string; args: string[]; coverageFlag: string }
> = {
    vitest: { command: 'npx', args: ['vitest', 'run'], coverageFlag: '--coverage' },
    jest: { command: 'npx', args: ['jest'], coverageFlag: '--coverage' },
    mocha: { command: 'npx', args: ['mocha'], coverageFlag: '' },
    playwright: { command: 'npx', args: ['playwright', 'test'], coverageFlag: '' },
};

interface BuiltTestCommand {
    command: string;
    args: string[];
}

/** Default timeout for test runs (5 minutes) */
const DEFAULT_TEST_TIMEOUT = 5 * 60 * 1000;

/** Maximum output buffer size (1MB) */
const MAX_OUTPUT_BUFFER = 1024 * 1024;

export class AgentTestRunnerService extends BaseService {
    private activePlanCoverage: Map<string, TestCoverageResult[]> = new Map();

    constructor() {
        super('AgentTestRunnerService');
    }

    // ===== AGT-TST-01: Auto-run Tests =====

    /**
     * Run tests for a step based on its configuration
     */
    async runTestsForStep(
        workspacePath: string,
        stepTestConfig: StepTestConfig,
        planTestConfig?: TestRunConfig
    ): Promise<TestRunResult> {
        if (!stepTestConfig.enabled) {
            return this.createSkippedResult('Tests disabled for this step');
        }

        const config: TestRunConfig = {
            command: stepTestConfig.command ?? planTestConfig?.command ?? 'npm test',
            framework: planTestConfig?.framework ?? 'vitest',
            timeout: planTestConfig?.timeout ?? DEFAULT_TEST_TIMEOUT,
            coverageEnabled: planTestConfig?.coverageEnabled ?? false,
            filter: stepTestConfig.filter,
        };

        return this.runTests(workspacePath, config);
    }

    /**
     * Run tests with the given configuration
     */
    async runTests(workspacePath: string, config: TestRunConfig): Promise<TestRunResult> {
        const startedAt = Date.now();
        appLogger.info('AgentTestRunner', `Running tests in ${workspacePath} with ${config.framework}`);

        try {
            const command = this.buildTestCommand(config);
            const output = await this.executeTestCommand(workspacePath, command, config.timeout);

            const result = this.parseTestOutput(output, config.framework, startedAt);
            appLogger.info(
                'AgentTestRunner',
                `Tests completed: ${result.passed}/${result.totalTests} passed in ${result.duration}ms`
            );

            return result;
        } catch (error) {
            appLogger.error('AgentTestRunner', 'Test execution failed', error as Error);
            return this.createErrorResult(error as Error, startedAt);
        }
    }

    /**
     * Build the test command based on configuration
     */
    private buildTestCommand(config: TestRunConfig): BuiltTestCommand {
        let built = this.parseCommand(config.command);

        // Use framework-specific command if available
        if (config.framework !== 'custom' && FRAMEWORK_CONFIGS[config.framework]) {
            const frameworkConfig = FRAMEWORK_CONFIGS[config.framework];
            built = {
                command: frameworkConfig.command,
                args: [...frameworkConfig.args],
            };

            if (config.coverageEnabled && frameworkConfig.coverageFlag) {
                built.args.push(frameworkConfig.coverageFlag);
            }
        }

        // Add filter if specified
        if (config.filter) {
            built.args.push('--grep', config.filter);
        }

        // Add JSON output for better parsing (framework-specific)
        if (config.framework === 'vitest') {
            built.args.push('--reporter=json');
        } else if (config.framework === 'jest') {
            built.args.push('--json');
        }

        return built;
    }

    /**
     * Execute the test command in a subprocess
     */
    private executeTestCommand(
        workspacePath: string,
        builtCommand: BuiltTestCommand,
        timeout: number = DEFAULT_TEST_TIMEOUT
    ): Promise<string> {
        return new Promise((resolve, reject) => {
            let output = '';
            let errorOutput = '';

            const proc = spawn(builtCommand.command, builtCommand.args, {
                cwd: workspacePath,
                shell: false,
                env: { ...process.env, CI: 'true', FORCE_COLOR: '0' },
            });

            const timeoutId = setTimeout(() => {
                proc.kill('SIGTERM');
                reject(new Error(`Test execution timed out after ${timeout}ms`));
            }, timeout);

            proc.stdout.on('data', (data: Buffer) => {
                const chunk = data.toString();
                if (output.length + chunk.length < MAX_OUTPUT_BUFFER) {
                    output += chunk;
                }
            });

            proc.stderr.on('data', (data: Buffer) => {
                const chunk = data.toString();
                if (errorOutput.length + chunk.length < MAX_OUTPUT_BUFFER) {
                    errorOutput += chunk;
                }
            });

            proc.on('close', (_code) => {
                clearTimeout(timeoutId);
                // Tests can exit with non-zero for failures, that's normal
                resolve(output + '\n' + errorOutput);
            });

            proc.on('error', (error) => {
                clearTimeout(timeoutId);
                reject(error);
            });
        });
    }

    private parseCommand(command: string): BuiltTestCommand {
        const tokens = command.match(/(?:[^\s"]+|"[^"]*")+/g) ?? [];
        if (tokens.length === 0) {
            throw new Error('Invalid test command: empty command');
        }
        const [cmd, ...rawArgs] = tokens;
        if (!cmd) {
            throw new Error('Invalid test command: no command found');
        }
        return {
            command: cmd.replace(/^"(.*)"$/u, '$1'),
            args: rawArgs.map(arg => arg.replace(/^"(.*)"$/u, '$1')),
        };
    }

    // ===== AGT-TST-02: Test Result Parsing =====

    /**
     * Parse test output based on framework
     */
    private parseTestOutput(
        output: string,
        _framework: string,
        startedAt: number
    ): TestRunResult {
        const completedAt = Date.now();
        const duration = completedAt - startedAt;

        // Try to parse JSON output first
        const jsonResult = this.tryParseJsonOutput(output, _framework);
        if (jsonResult?.success !== undefined) {
            return {
                success: jsonResult.success,
                totalTests: jsonResult.totalTests ?? 0,
                passed: jsonResult.passed ?? 0,
                failed: jsonResult.failed ?? 0,
                skipped: jsonResult.skipped ?? 0,
                tests: jsonResult.tests ?? [],
                coverage: jsonResult.coverage,
                startedAt,
                completedAt,
                duration,
                output,
            };
        }

        // Fall back to regex parsing
        return this.parseOutputWithRegex(output, startedAt, completedAt, duration);
    }

    /**
     * Try to parse JSON test output
     */
    private tryParseJsonOutput(
        output: string,
        _framework: string
    ): Partial<TestRunResult> | null {
        try {
            // Find JSON in output
            const jsonMatch = output.match(/\{[\s\S]*"numTotalTests"[\s\S]*\}/);
            if (!jsonMatch) {
                return null;
            }

            const json = JSON.parse(jsonMatch[0]) as {
                numTotalTests?: number;
                numPassedTests?: number;
                numFailedTests?: number;
                numPendingTests?: number;
                testResults?: Array<{
                    name: string;
                    status: string;
                    duration?: number;
                    failureMessages?: string[];
                    ancestorTitles?: string[];
                }>;
                coverageMap?: Record<string, unknown>;
            };

            const tests: TestCaseResult[] = [];

            if (json.testResults) {
                for (const test of json.testResults) {
                    tests.push({
                        name: test.name,
                        suite: test.ancestorTitles?.join(' > ') ?? '',
                        status: this.mapTestStatus(test.status),
                        duration: test.duration ?? 0,
                        error: test.failureMessages?.length
                            ? { message: test.failureMessages.join('\n') }
                            : undefined,
                    });
                }
            }

            return {
                success: (json.numFailedTests ?? 0) === 0,
                totalTests: json.numTotalTests ?? 0,
                passed: json.numPassedTests ?? 0,
                failed: json.numFailedTests ?? 0,
                skipped: json.numPendingTests ?? 0,
                tests,
                coverage: json.coverageMap ? this.parseCoverageMap(json.coverageMap) : undefined,
            };
        } catch {
            return null;
        }
    }

    /**
     * Parse test output using regex patterns
     */
    private parseOutputWithRegex(
        output: string,
        startedAt: number,
        completedAt: number,
        duration: number
    ): TestRunResult {
        const tests: TestCaseResult[] = [];

        // Common patterns for test results
        const passPattern = /✓|PASS|passed/gi;
        const failPattern = /✗|FAIL|failed/gi;
        const skipPattern = /○|SKIP|skipped|pending/gi;

        const passCount = (output.match(passPattern) ?? []).length;
        const failCount = (output.match(failPattern) ?? []).length;
        const skipCount = (output.match(skipPattern) ?? []).length;

        // Try to extract individual test names
        const testLinePattern = /(?:✓|✗|○|PASS|FAIL)\s+(.+?)(?:\s+\([\d.]+\s*m?s\))?$/gm;
        let match;
        while ((match = testLinePattern.exec(output)) !== null) {
            const line = match[0];
            const name = match[1].trim();
            const isPass = /✓|PASS/.test(line);
            const isFail = /✗|FAIL/.test(line);

            tests.push({
                name,
                suite: '',
                status: isPass ? 'passed' : isFail ? 'failed' : 'skipped',
                duration: 0,
            });
        }

        // Extract summary line if available
        const summaryPattern = /(\d+)\s+(?:tests?|specs?)\s+(?:passed|total)/i;
        const summaryMatch = output.match(summaryPattern);
        const totalTests = summaryMatch
            ? parseInt(summaryMatch[1], 10)
            : passCount + failCount + skipCount;

        return {
            success: failCount === 0,
            totalTests,
            passed: passCount,
            failed: failCount,
            skipped: skipCount,
            duration,
            startedAt,
            completedAt,
            tests,
            output,
        };
    }

    /**
     * Map framework-specific status to our status type
     */
    private mapTestStatus(status: string): TestCaseResult['status'] {
        const normalized = status.toLowerCase();
        if (normalized === 'passed' || normalized === 'pass') {
            return 'passed';
        }
        if (normalized === 'failed' || normalized === 'fail') {
            return 'failed';
        }
        if (normalized === 'skipped' || normalized === 'skip' || normalized === 'todo') {
            return 'skipped';
        }
        return 'pending';
    }

    // ===== AGT-TST-04: Coverage Tracking =====

    /**
     * Parse coverage map from test output
     */
    private parseCoverageMap(coverageMap: Record<string, unknown>): TestCoverageResult {
        const files: TestCoverageResult['files'] = [];
        let totalLines = 0, coveredLines = 0;
        let totalBranches = 0, coveredBranches = 0;
        let totalFunctions = 0, coveredFunctions = 0;
        let totalStatements = 0, coveredStatements = 0;

        for (const [filePath, coverage] of Object.entries(coverageMap)) {
            const fileCoverage = coverage as {
                s?: Record<string, number>;
                b?: Record<string, number[]>;
                f?: Record<string, number>;
            };

            const statements = fileCoverage.s ?? {};
            const branches = fileCoverage.b ?? {};
            const functions = fileCoverage.f ?? {};

            const fileStats = {
                path: filePath,
                statements: this.calculatePercentage(statements),
                branches: this.calculateBranchPercentage(branches),
                functions: this.calculatePercentage(functions),
                lines: this.calculatePercentage(statements), // Approximation
            };

            files.push(fileStats);

            // Aggregate totals
            const stmtValues = Object.values(statements);
            totalStatements += stmtValues.length;
            coveredStatements += stmtValues.filter(v => v > 0).length;

            const funcValues = Object.values(functions);
            totalFunctions += funcValues.length;
            coveredFunctions += funcValues.filter(v => v > 0).length;

            for (const branchArray of Object.values(branches)) {
                totalBranches += branchArray.length;
                coveredBranches += branchArray.filter(v => v > 0).length;
            }

            totalLines += stmtValues.length;
            coveredLines += stmtValues.filter(v => v > 0).length;
        }

        return {
            lines: {
                covered: coveredLines,
                total: totalLines,
                percentage: totalLines > 0 ? (coveredLines / totalLines) * 100 : 0,
            },
            branches: {
                covered: coveredBranches,
                total: totalBranches,
                percentage: totalBranches > 0 ? (coveredBranches / totalBranches) * 100 : 0,
            },
            functions: {
                covered: coveredFunctions,
                total: totalFunctions,
                percentage: totalFunctions > 0 ? (coveredFunctions / totalFunctions) * 100 : 0,
            },
            statements: {
                covered: coveredStatements,
                total: totalStatements,
                percentage: totalStatements > 0 ? (coveredStatements / totalStatements) * 100 : 0,
            },
            files,
        };
    }

    /**
     * Calculate coverage percentage from a hit map
     */
    private calculatePercentage(hitMap: Record<string, number>): number {
        const values = Object.values(hitMap);
        if (values.length === 0) {
            return 100;
        }
        const covered = values.filter(v => v > 0).length;
        return (covered / values.length) * 100;
    }

    /**
     * Calculate branch coverage percentage
     */
    private calculateBranchPercentage(branchMap: Record<string, number[]>): number {
        let total = 0;
        let covered = 0;
        for (const branches of Object.values(branchMap)) {
            total += branches.length;
            covered += branches.filter(v => v > 0).length;
        }
        return total > 0 ? (covered / total) * 100 : 100;
    }

    /**
     * Track coverage for a plan
     */
    trackPlanCoverage(planId: string, coverage: TestCoverageResult): void {
        const existing = this.activePlanCoverage.get(planId) ?? [];
        existing.push(coverage);
        this.activePlanCoverage.set(planId, existing);
    }

    /**
     * Get aggregated coverage for a plan
     */
    getPlanCoverage(planId: string): TestCoverageResult | null {
        const coverages = this.activePlanCoverage.get(planId);
        if (!coverages || coverages.length === 0) {
            return null;
        }

        // Return the latest coverage (most accurate)
        return coverages[coverages.length - 1];
    }

    /**
     * Clear coverage tracking for a plan
     */
    clearPlanCoverage(planId: string): void {
        this.activePlanCoverage.delete(planId);
    }

    // ===== Helper Methods =====

    /**
     * Create a skipped result
     */
    private createSkippedResult(reason: string): TestRunResult {
        const now = Date.now();
        return {
            success: true,
            totalTests: 0,
            passed: 0,
            failed: 0,
            skipped: 0,
            duration: 0,
            startedAt: now,
            completedAt: now,
            tests: [],
            output: reason,
        };
    }

    /**
     * Create an error result
     */
    private createErrorResult(error: Error, startedAt: number): TestRunResult {
        const completedAt = Date.now();
        return {
            success: false,
            totalTests: 0,
            passed: 0,
            failed: 1,
            skipped: 0,
            duration: completedAt - startedAt,
            startedAt,
            completedAt,
            tests: [{
                name: 'Test Execution',
                suite: 'Error',
                status: 'failed',
                duration: 0,
                error: {
                    message: error.message,
                    stack: error.stack,
                },
            }],
            output: `Error: ${error.message}\n${error.stack ?? ''}`,
        };
    }

    /**
     * Check if tests should fail the step
     */
    shouldFailStep(testConfig: StepTestConfig, result: TestRunResult): boolean {
        if (!testConfig.failOnTestFailure) {
            return false;
        }
        return !result.success;
    }
}

// Singleton instance
let instance: AgentTestRunnerService | null = null;

export function getAgentTestRunnerService(): AgentTestRunnerService {
    instance ??= new AgentTestRunnerService();
    return instance;
}

