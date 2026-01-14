import { LLMService } from '@main/services/llm/llm.service';
import { MultiLLMOrchestrator, LLMTask } from '@main/services/multi-llm-orchestrator.service';
import { ChatMessage, OpenAIResponse } from '@main/types/llm.types';
import { ServiceResponse } from '@shared/types';
import { BaseService } from '@main/services/base.service';
import { getErrorMessage } from '@shared/utils/error.util';
import { v4 as uuidv4 } from 'uuid';

export interface ComparisonRequest {
    chatId: string;
    messages: ChatMessage[];
    models: Array<{ provider: string; model: string }>;
}

export interface ComparisonResponse {
    results: Record<string, { success: boolean; data?: OpenAIResponse; error?: string }>;
}

export class MultiModelComparisonService extends BaseService {
    constructor(
        private llmService: LLMService,
        private orchestrator: MultiLLMOrchestrator
    ) {
        super('MultiModelComparisonService');
    }

    async compareModels(request: ComparisonRequest): Promise<ServiceResponse<ComparisonResponse>> {
        const results: Record<string, { success: boolean; data?: OpenAIResponse; error?: string }> = {};
        const promises: Array<Promise<void>> = [];

        for (const target of request.models) {
            const taskId = uuidv4();
            const modelKey = `${target.provider}:${target.model}`;

            const task: LLMTask = {
                taskId,
                chatId: request.chatId,
                provider: target.provider,
                model: target.model,
                execute: async () => {
                    try {
                        const response = await this.llmService.chat(
                            request.messages,
                            target.model,
                            [],
                            target.provider
                        );
                        results[modelKey] = { success: true, data: response };
                    } catch (error) {
                        results[modelKey] = { success: false, error: getErrorMessage(error) };
                    }
                }
            };

            promises.push(this.orchestrator.addTask(task));
        }

        try {
            // Wait for all tasks to be at least "handled" (executed or queued and finished)
            // Note: addTask returns when the task is added, not when it's finished.
            // We need a way to wait for the tasks to finish.
            // Let's modify the execute wrapper to notify us.

            await this.waitForComparison(promises, results, request.models.length);

            return { success: true, result: { results } };
        } catch (error) {
            return { success: false, error: getErrorMessage(error) };
        }
    }

    private async waitForComparison(
        addPromises: Array<Promise<void>>,
        results: Record<string, any>,
        expectedCount: number
    ): Promise<void> {
        // Wait for all addTask calls to complete
        await Promise.all(addPromises);

        // Simple polling for results (NASA Rule 2: Fixed loop bounds)
        let attempts = 0;
        const maxAttempts = 120; // 60 seconds with 500ms sleep

        while (Object.keys(results).length < expectedCount && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 500));
            attempts++;
        }

        if (attempts >= maxAttempts) {
            console.warn('[MultiModelComparisonService] Comparison timed out for some models');
        }
    }
}
