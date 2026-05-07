/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { LLMService } from '@main/services/llm/llm.service';
import { ModelSelectionService } from '@main/services/llm/model-selection.service';
import { ProxyService } from '@main/services/proxy/proxy.service';
import { CouncilCapabilityService } from '@main/services/session/capabilities/council-capability.service';
import { WorkspaceStep } from '@shared/types/council';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('CouncilCapabilityService', () => {
    let service: CouncilCapabilityService;
    let mockLlm: any;
    let mockProxy: any;
    let mockModelSelection: any;

    beforeEach(() => {
        mockLlm = {
            getAvailableProviders: vi.fn().mockResolvedValue(['openai', 'anthropic', 'google']),
        };
        mockProxy = {
            getAntigravityAvailableModels: vi.fn().mockResolvedValue([]),
            getClaudeQuota: vi.fn().mockResolvedValue({ accounts: [] }),
        };
        mockModelSelection = {
            recommendBackgroundModel: vi.fn().mockResolvedValue({
                selection: null,
                reason: 'No recommendation',
            }),
        };

        service = new CouncilCapabilityService({
            llm: mockLlm as LLMService,
            proxy: mockProxy as ProxyService,
            modelSelectionService: mockModelSelection as ModelSelectionService,
            databaseService: { getUsageRecords: vi.fn().mockResolvedValue([]) } as any,
        });
    });

    it('should initialize and cleanup without error', async () => {
        await service.initialize();
        await service.cleanup();
    });

    describe('prepareCouncilPlan', () => {
        it('should enrich steps with model configurations', async () => {
            const steps: WorkspaceStep[] = [
                { id: 'step-1', text: 'Write a python script', priority: 'normal' } as WorkspaceStep,
                { id: 'step-2', text: 'Review the code', priority: 'high' } as WorkspaceStep,
            ];

            const plan = await service.prepareCouncilPlan('task-1', steps);

            expect(plan).toHaveLength(2);
            expect(plan[0].modelConfig).toBeDefined();
            expect(plan[0].requiresApproval).toBe(false);
            expect(plan[1].modelConfig).toBeDefined();
            expect(plan[1].requiresApproval).toBe(true); // high priority requires approval
        });

        it('should use taskType from step if provided', async () => {
            const steps: WorkspaceStep[] = [
                { id: 'step-1', text: 'Generic text', taskType: 'research' } as WorkspaceStep,
            ];

            const plan = await service.prepareCouncilPlan('task-1', steps);
            expect(plan[0].modelConfig?.reason).toContain('research');
        });
    });

    describe('routing and quota awareness', () => {
        it('should use ModelSelectionService recommendation if available for general tasks', async () => {
            mockModelSelection.recommendBackgroundModel.mockResolvedValue({
                selection: { provider: 'openai', model: 'gpt-4o' },
                reason: 'Cost efficient',
            });

            const steps: WorkspaceStep[] = [
                { id: 'step-1', text: 'Just chatting', taskType: 'general' } as WorkspaceStep,
            ];

            const plan = await service.prepareCouncilPlan('task-1', steps);
            expect(plan[0].modelConfig?.model).toBe('gpt-4o');
            expect(plan[0].modelConfig?.reason).toContain('Cost efficient');
        });

        it('should handle low quota for Antigravity models', async () => {
            mockLlm.getAvailableProviders.mockResolvedValue(['antigravity']);
            mockProxy.getAntigravityAvailableModels.mockResolvedValue([
                {
                    id: 'gpt-4o',
                    quotaInfo: { remainingFraction: 0.05 }, // Low quota
                },
            ]);

            const steps: WorkspaceStep[] = [
                { id: 'step-1', text: 'Do something', taskType: 'general' } as WorkspaceStep,
            ];

            // We just verify it doesn't crash and logs a warning (which we can't easily check here without mocking logger)
            const plan = await service.prepareCouncilPlan('task-1', steps);
            expect(plan[0].modelConfig).toBeDefined();
        });

        it('should handle high utilization for Claude accounts', async () => {
            mockLlm.getAvailableProviders.mockResolvedValue(['anthropic']);
            mockProxy.getClaudeQuota.mockResolvedValue({
                accounts: [
                    {
                        fiveHour: { utilization: 0.95 },
                    },
                ],
            });

            const steps: WorkspaceStep[] = [
                { id: 'step-1', text: 'Review this', taskType: 'code_review' } as WorkspaceStep,
            ];

            const plan = await service.prepareCouncilPlan('task-1', steps);
            expect(plan[0].modelConfig).toBeDefined();
        });
    });

    describe('detectTaskType', () => {
        it('should detect code generation from keywords', async () => {
            const steps = await service.prepareCouncilPlan('t', [{ text: 'implement a feature' }] as any);
            expect(steps[0].modelConfig?.reason).toContain('code_generation');
        });

        it('should detect debugging from keywords', async () => {
            const steps = await service.prepareCouncilPlan('t', [{ text: 'fix this bug' }] as any);
            expect(steps[0].modelConfig?.reason).toContain('debugging');
        });

        it('should detect research from keywords', async () => {
            const steps = await service.prepareCouncilPlan('t', [{ text: 'analyze this data' }] as any);
            expect(steps[0].modelConfig?.reason).toContain('research');
        });

        it('should default to general', async () => {
            const steps = await service.prepareCouncilPlan('t', [{ text: 'hello' }] as any);
            expect(steps[0].modelConfig?.reason).toContain('general');
        });
    });
});

