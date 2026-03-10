import { AgentTestRunnerService } from '@main/services/workspace/automation-workflow/agent-test-runner.service';
import { StepTestConfig, TestCoverageResult, TestRunConfig } from '@shared/types/automation-workflow';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('child_process', () => ({
    spawn: vi.fn(),
}));

vi.mock('@main/logging/logger', () => ({
    appLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

import { spawn } from 'child_process';

const mockSpawn = vi.mocked(spawn);

function createMockProcess(): {
    stdout: { on: ReturnType<typeof vi.fn> };
    stderr: { on: ReturnType<typeof vi.fn> };
    on: ReturnType<typeof vi.fn>;
    kill: ReturnType<typeof vi.fn>;
} {
    const proc = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn(),
        kill: vi.fn(),
    };
    return proc;
}

function setupMockProcess(output: string, exitCode = 0): void {
    const proc = createMockProcess();
    mockSpawn.mockReturnValue(proc as never);

    proc.stdout.on.mockImplementation((_event: string, cb: (data: Buffer) => void) => {
        cb(Buffer.from(output));
    });
    proc.stderr.on.mockImplementation((_event: string, _cb: (data: Buffer) => void) => {
        // no stderr
    });
    proc.on.mockImplementation((event: string, cb: (code: number) => void) => {
        if (event === 'close') {
            setTimeout(() => cb(exitCode), 0);
        }
    });
}

function setupMockProcessError(error: Error): void {
    const proc = createMockProcess();
    mockSpawn.mockReturnValue(proc as never);

    proc.stdout.on.mockImplementation(() => {});
    proc.stderr.on.mockImplementation(() => {});
    proc.on.mockImplementation((event: string, cb: (err: Error) => void) => {
        if (event === 'error') {
            setTimeout(() => cb(error), 0);
        }
    });
}

describe('AgentTestRunnerService', () => {
    let service: AgentTestRunnerService;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers({ shouldAdvanceTime: true });
        service = new AgentTestRunnerService();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('runTestsForStep', () => {
        it('should return skipped result when tests are disabled', async () => {
            const stepConfig: StepTestConfig = {
                enabled: false,
                runAfterStep: false,
                failOnTestFailure: false,
            };

            const result = await service.runTestsForStep('/workspace', stepConfig);

            expect(result.success).toBe(true);
            expect(result.totalTests).toBe(0);
            expect(result.output).toContain('disabled');
        });

        it('should run tests with merged config when enabled', async () => {
            setupMockProcess('✓ test1\n✓ test2\n2 tests passed');

            const stepConfig: StepTestConfig = {
                enabled: true,
                runAfterStep: true,
                failOnTestFailure: true,
                filter: 'myTest',
            };

            const planConfig: TestRunConfig = {
                command: 'npm test',
                framework: 'vitest',
                timeout: 30000,
                coverageEnabled: false,
            };

            const result = await service.runTestsForStep('/workspace', stepConfig, planConfig);
            expect(result).toBeDefined();
            expect(mockSpawn).toHaveBeenCalled();
        });
    });

    describe('runTests', () => {
        it('should execute tests and return parsed results', async () => {
            setupMockProcess('✓ test1\n✓ test2\n2 tests passed');

            const config: TestRunConfig = {
                command: 'npm test',
                framework: 'vitest',
                timeout: 30000,
            };

            const result = await service.runTests('/workspace', config);

            expect(result.success).toBe(true);
            expect(mockSpawn).toHaveBeenCalled();
        });

        it('should return error result when spawn fails', async () => {
            setupMockProcessError(new Error('Command not found'));

            const config: TestRunConfig = {
                command: 'npm test',
                framework: 'vitest',
            };

            const result = await service.runTests('/workspace', config);

            expect(result.success).toBe(false);
            expect(result.failed).toBe(1);
            expect(result.tests[0]?.error?.message).toContain('Command not found');
        });

        it('should parse JSON output from jest', async () => {
            const jsonOutput = JSON.stringify({
                numTotalTests: 3,
                numPassedTests: 2,
                numFailedTests: 1,
                numPendingTests: 0,
                testResults: [
                    { name: 'test1', status: 'passed', duration: 10, ancestorTitles: ['suite1'] },
                    { name: 'test2', status: 'passed', duration: 20, ancestorTitles: ['suite1'] },
                    {
                        name: 'test3',
                        status: 'failed',
                        duration: 5,
                        failureMessages: ['Expected true to be false'],
                        ancestorTitles: ['suite2'],
                    },
                ],
            });
            setupMockProcess(jsonOutput);

            const config: TestRunConfig = {
                command: 'npx jest',
                framework: 'jest',
            };

            const result = await service.runTests('/workspace', config);

            expect(result.success).toBe(false);
            expect(result.totalTests).toBe(3);
            expect(result.passed).toBe(2);
            expect(result.failed).toBe(1);
            expect(result.tests).toHaveLength(3);
        });

        it('should add coverage flag when enabled', async () => {
            setupMockProcess('✓ test1');

            const config: TestRunConfig = {
                command: 'npm test',
                framework: 'vitest',
                coverageEnabled: true,
            };

            await service.runTests('/workspace', config);

            const spawnArgs = mockSpawn.mock.calls[0];
            expect(spawnArgs[1]).toContain('--coverage');
        });

        it('should add filter and reporter flags for vitest', async () => {
            setupMockProcess('✓ test1');

            const config: TestRunConfig = {
                command: 'npm test',
                framework: 'vitest',
                filter: 'myFilter',
            };

            await service.runTests('/workspace', config);

            const spawnArgs = mockSpawn.mock.calls[0];
            expect(spawnArgs[1]).toContain('--grep');
            expect(spawnArgs[1]).toContain('myFilter');
            expect(spawnArgs[1]).toContain('--reporter=json');
        });
    });

    describe('shouldFailStep', () => {
        it('should return false when failOnTestFailure is false', () => {
            const config: StepTestConfig = {
                enabled: true,
                runAfterStep: true,
                failOnTestFailure: false,
            };

            const result = service.shouldFailStep(config, {
                success: false,
                totalTests: 1,
                passed: 0,
                failed: 1,
                skipped: 0,
                duration: 100,
                startedAt: 0,
                completedAt: 100,
                tests: [],
                output: '',
            });

            expect(result).toBe(false);
        });

        it('should return true when failOnTestFailure is true and tests failed', () => {
            const config: StepTestConfig = {
                enabled: true,
                runAfterStep: true,
                failOnTestFailure: true,
            };

            const result = service.shouldFailStep(config, {
                success: false,
                totalTests: 1,
                passed: 0,
                failed: 1,
                skipped: 0,
                duration: 100,
                startedAt: 0,
                completedAt: 100,
                tests: [],
                output: '',
            });

            expect(result).toBe(true);
        });
    });

    describe('coverage tracking', () => {
        const mockCoverage: TestCoverageResult = {
            lines: { covered: 80, total: 100, percentage: 80 },
            branches: { covered: 60, total: 100, percentage: 60 },
            functions: { covered: 90, total: 100, percentage: 90 },
            statements: { covered: 85, total: 100, percentage: 85 },
            files: [],
        };

        it('should track coverage for a plan', () => {
            service.trackPlanCoverage('plan-1', mockCoverage);
            const result = service.getPlanCoverage('plan-1');

            expect(result).toBeDefined();
            expect(result?.lines.percentage).toBe(80);
        });

        it('should return null for unknown plan', () => {
            expect(service.getPlanCoverage('unknown')).toBeNull();
        });

        it('should return latest coverage when multiple tracked', () => {
            const laterCoverage: TestCoverageResult = {
                ...mockCoverage,
                lines: { covered: 90, total: 100, percentage: 90 },
            };

            service.trackPlanCoverage('plan-1', mockCoverage);
            service.trackPlanCoverage('plan-1', laterCoverage);

            const result = service.getPlanCoverage('plan-1');
            expect(result?.lines.percentage).toBe(90);
        });

        it('should clear coverage for a plan', () => {
            service.trackPlanCoverage('plan-1', mockCoverage);
            service.clearPlanCoverage('plan-1');

            expect(service.getPlanCoverage('plan-1')).toBeNull();
        });
    });
});

