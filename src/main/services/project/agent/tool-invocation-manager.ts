import { InternalToolResult, ToolExecutor } from '@main/tools/tool-executor';
import { ToolCall } from '@shared/types/chat';
import { delay } from '@shared/utils/delay.util';
import { safeJsonParse } from '@shared/utils/sanitize.util';

interface ToolInvocationManagerDependencies {
    taskId: string;
    getToolExecutor: () => ToolExecutor | undefined;
    shouldStop: () => boolean;
    isBudgetLimited: () => boolean;
    errorRecoveryTemplates: Record<string, string>;
    logInfo: (message: string) => void;
    logWarn: (message: string) => void;
    logError: (message: string, error?: Error) => void;
}

export interface ToolInvocationResultItem {
    toolCallId: string;
    result: InternalToolResult;
}

export class ToolInvocationManager {
    constructor(private readonly deps: ToolInvocationManagerDependencies) {}

    async executeToolCalls(
        toolCalls: ToolCall[],
        maxParallel: number = 3
    ): Promise<ToolInvocationResultItem[]> {
        const toolExecutor = this.deps.getToolExecutor();
        if (!toolExecutor) {
            return [];
        }

        this.deps.logInfo(`Executing ${toolCalls.length} tool calls (AGT-10)`);
        const results: ToolInvocationResultItem[] = [];
        for (let i = 0; i < toolCalls.length; i += maxParallel) {
            const chunk = toolCalls.slice(i, i + maxParallel);
            const chunkResults = await Promise.all(
                chunk.map(async toolCall => ({
                    toolCallId: toolCall.id,
                    result: await this.executeToolWithRetry(toolCall),
                }))
            );
            results.push(...chunkResults);
        }
        return results;
    }

    private async executeToolWithRetry(
        toolCall: ToolCall,
        maxRetries: number = 2
    ): Promise<InternalToolResult> {
        let lastResult: InternalToolResult = { success: false, error: 'Not started' };
        for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
            if (this.deps.shouldStop()) {
                break;
            }
            const timeoutMs = attempt > 0 ? 60000 : (this.deps.isBudgetLimited() ? 45000 : 30000);
            try {
                const toolExecutor = this.deps.getToolExecutor();
                if (!toolExecutor) {
                    this.deps.logError('ToolExecutor is missing during retry', new Error('ToolExecutor not initialized'));
                    break;
                }
                lastResult = await toolExecutor.execute(
                    toolCall.function.name,
                    safeJsonParse(toolCall.function.arguments, {}),
                    { taskId: this.deps.taskId, timeoutMs }
                );
                if (lastResult.success) {
                    return lastResult;
                }
                if (attempt === 0 && lastResult.errorType) {
                    const advice = this.deps.errorRecoveryTemplates[lastResult.errorType] ?? this.deps.errorRecoveryTemplates.unknown;
                    lastResult.error = `${lastResult.error}\n\nRecovery Advice: ${advice}`;
                }
                if (lastResult.errorType !== 'timeout' && lastResult.errorType !== 'unknown') {
                    this.deps.logWarn(`Tool ${toolCall.function.name} failed with non-retryable error: ${lastResult.errorType}`);
                    break;
                }
                if (attempt < maxRetries) {
                    const backoffMs = Math.pow(2, attempt) * 1000;
                    this.deps.logWarn(`Tool ${toolCall.function.name} failed (${lastResult.errorType}, attempt ${attempt + 1}), retrying in ${backoffMs}ms...`);
                    await delay(backoffMs);
                }
            } catch (error) {
                const err = error as Error;
                this.deps.logError(`Unexpected error in executeToolWithRetry for ${toolCall.function.name}`, err);
                lastResult = { success: false, error: err.message, errorType: 'unknown' };
                if (attempt >= maxRetries) {
                    break;
                }
                await delay(1000);
            }
        }
        return lastResult;
    }
}
