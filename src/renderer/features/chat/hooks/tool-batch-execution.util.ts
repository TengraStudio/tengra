import { generateId } from '@/lib/utils';
import { Message } from '@/types';

export interface ExecuteBatchToolCallsParams {
    toolCalls: NonNullable<Message['toolCalls']>;
    workspacePath: string | undefined;
    t: (key: string) => string;
    chatId: string | undefined;
    accumulatedMessages: Message[];
    executeToolCall: (
        toolCall: NonNullable<Message['toolCalls']>[number],
        activeWorkspacePath: string | undefined,
        translate: (key: string) => string,
        activeChatId?: string
    ) => Promise<{
        toolMessage: Message;
        generatedImages: string[];
    }>;
    onToolProgress?: (toolResults: Message[]) => void;
}

export async function executeBatchToolCalls(
    params: ExecuteBatchToolCallsParams
): Promise<{ toolResults: Message[]; generatedImages: string[] }> {
    const {
        toolCalls,
        workspacePath,
        t,
        chatId,
        accumulatedMessages,
        executeToolCall,
        onToolProgress,
    } = params;
    const toolResults: Message[] = [];
    const generatedImages: string[] = [];

    for (const toolCall of toolCalls) {
        try {
            const executedTool = await executeToolCall(toolCall, workspacePath, t, chatId);
            generatedImages.push(...executedTool.generatedImages);
            toolResults.push(executedTool.toolMessage);
            accumulatedMessages.push(executedTool.toolMessage);
            onToolProgress?.([...toolResults]);
        } catch (error) {
            const syntheticToolMessage: Message = {
                id: generateId(),
                role: 'tool',
                content: JSON.stringify({
                    success: false,
                    error: error instanceof Error ? error.message : String(error),
                    tool: toolCall.function.name,
                }),
                toolCallId: toolCall.id,
                timestamp: new Date(),
            };
            toolResults.push(syntheticToolMessage);
            accumulatedMessages.push(syntheticToolMessage);
            onToolProgress?.([...toolResults]);
        }
    }

    return { toolResults, generatedImages };
}
