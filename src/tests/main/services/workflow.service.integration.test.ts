/**
 * Integration tests for WorkflowService (BACKLOG-0432)
 */
import { afterEach,beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
    app: { getPath: vi.fn().mockReturnValue('/mock/userData') }
}));

vi.mock('fs/promises', () => ({
    readFile: vi.fn().mockRejectedValue({ code: 'ENOENT' }),
    writeFile: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('@main/logging/logger', () => ({
    appLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }
}));

import {
    WORKFLOW_PERFORMANCE_BUDGETS,
    WorkflowErrorCode,
    WorkflowService,
    WorkflowTelemetryEvent} from '@main/services/workflow/workflow.service';

describe('WorkflowService Integration', () => {
    let service: WorkflowService;

    beforeEach(async () => {
        vi.clearAllMocks();
        service = new WorkflowService();
        await service.initialize();
    });

    afterEach(async () => {
        await service.cleanup();
    });

    it('should start with no workflows', () => {
        expect(service.getAllWorkflows()).toHaveLength(0);
    });

    it('should report health after initialization', () => {
        const health = service.getHealth();
        expect(health.totalWorkflows).toBe(0);
        expect(health.enabledWorkflows).toBe(0);
    });

    it('should have valid error codes', () => {
        expect(WorkflowErrorCode.NOT_FOUND).toBeDefined();
        expect(WorkflowErrorCode.DISABLED).toBeDefined();
        expect(WorkflowErrorCode.INVALID_INPUT).toBeDefined();
        expect(WorkflowErrorCode.SAVE_FAILED).toBeDefined();
        expect(WorkflowErrorCode.LOAD_FAILED).toBeDefined();
        expect(WorkflowErrorCode.EXECUTION_FAILED).toBeDefined();
    });

    it('should have valid telemetry events', () => {
        expect(WorkflowTelemetryEvent.WORKFLOW_CREATED).toBeDefined();
        expect(WorkflowTelemetryEvent.WORKFLOW_UPDATED).toBeDefined();
        expect(WorkflowTelemetryEvent.WORKFLOW_DELETED).toBeDefined();
        expect(WorkflowTelemetryEvent.WORKFLOW_EXECUTED).toBeDefined();
    });

    it('should have valid performance budgets', () => {
        expect(WORKFLOW_PERFORMANCE_BUDGETS.CREATE_MS).toBeGreaterThan(0);
        expect(WORKFLOW_PERFORMANCE_BUDGETS.UPDATE_MS).toBeGreaterThan(0);
        expect(WORKFLOW_PERFORMANCE_BUDGETS.DELETE_MS).toBeGreaterThan(0);
        expect(WORKFLOW_PERFORMANCE_BUDGETS.EXECUTE_MS).toBeGreaterThan(0);
        expect(WORKFLOW_PERFORMANCE_BUDGETS.LOAD_MS).toBeGreaterThan(0);
        expect(WORKFLOW_PERFORMANCE_BUDGETS.SAVE_MS).toBeGreaterThan(0);
    });
});
