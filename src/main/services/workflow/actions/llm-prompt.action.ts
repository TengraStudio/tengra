import { LLMService } from '@main/services/llm/llm.service';
import { JsonValue } from '@shared/types/common';
import { WorkflowAction } from '@shared/types/workflow.types';
import { WorkflowContext } from '@shared/types/workflow-context.types';

import { IWorkflowActionHandler } from './action.interface';

/**
 * Action handler that sends a prompt to an LLM and stores the response
 * Useful for agent-driven workflows that need LLM reasoning
 */
export class LLMPromptAction implements IWorkflowActionHandler {
    type: string = 'llm_prompt';

    constructor(private llmService: LLMService) { }

    async execute(action: WorkflowAction, context?: WorkflowContext): Promise<JsonValue> {
        const prompt = action.config['prompt'];
        const model = action.config['model'] as string | undefined;
        const storeResultAs = action.config['storeResultAs'] as string | undefined;

        if (typeof prompt !== 'string') {
            throw new Error('LLMPromptAction requires a "prompt" string in config');
        }

        try {
            // Send prompt to LLM using chatOpenAI
            const response = await this.llmService.chatOpenAI(
                [{ role: 'user', content: prompt }],
                { model }
            );

            const result = response.content || '';

            // Store result in context if variable name provided
            if (context && storeResultAs) {
                context.variables[storeResultAs] = result;
            }

            return result;
        } catch (error) {
            throw new Error(`LLM prompt failed: ${error}`);
        }
    }
}
