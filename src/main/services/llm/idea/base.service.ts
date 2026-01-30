import { BaseService } from '@main/services/base.service';
import { LLMService } from '@main/services/llm/llm.service';
import { getErrorMessage } from '@shared/utils/error.util';
import { safeJsonParse } from '@shared/utils/sanitize.util';

export abstract class IdeaBaseService extends BaseService {
    constructor(
        name: string,
        protected readonly llmService: LLMService
    ) {
        super(name);
    }

    /**
     * Utility delay function for UX pacing
     */
    protected async delay(ms: number): Promise<void> {
        const multiplier = Number.parseInt(process.env.IDEA_DELAY_MULTIPLIER ?? '0.1', 10);
        await new Promise(resolve => setTimeout(resolve, ms * multiplier));
    }

    /**
     * Retry LLM calls with exponential backoff
     */
    public async retryLLMCall<T>(
        fn: () => Promise<T>,
        operation: string,
        maxRetries = 3
    ): Promise<T> {
        let lastError: Error | null = null;
        for (let i = 0; i < maxRetries; i++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error as Error;
                if (!this.isRetryableError(error)) { throw error; }

                const waitTime = Math.pow(2, i) * 1000;
                this.logWarn(`LLM call failed (${operation}), retrying in ${waitTime}ms... (Attempt ${i + 1}/${maxRetries})`);
                await this.delay(waitTime);
            }
        }
        throw lastError ?? new Error(`${operation} failed after ${maxRetries} retries`);
    }

    protected isRetryableError(error: unknown): boolean {
        const msg = getErrorMessage(error as Error).toLowerCase();
        return (
            msg.includes('rate limit') ||
            msg.includes('429') ||
            msg.includes('timeout') ||
            msg.includes('deadline exceeded') ||
            msg.includes('socket') ||
            msg.includes('network')
        );
    }

    /**
     * Generic JSON parser with markdown code block extraction
     */
    protected parseJsonResponse<T>(content: string, defaultValue: T | null = null): T {
        try {
            let jsonStr = content;
            const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (jsonMatch) {
                jsonStr = jsonMatch[1].trim();
            }
            return safeJsonParse(jsonStr, defaultValue) as T;
        } catch (error) {
            this.logWarn(`Failed to parse JSON response: ${getErrorMessage(error as Error)}`);
            if (defaultValue !== null) {
                return defaultValue;
            }
            throw error;
        }
    }
}
