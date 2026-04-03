import { generateId } from '@/lib/utils';
import { Message } from '@/types';

export async function executeBatchToolCalls(
    toolCalls: NonNullable<Message['toolCalls']>,
    workspacePath: string | undefined,
    t: (key: string) => string,
    chatId: string | undefined,
    accumulatedMessages: Message[],
    executeToolCall: (
        toolCall: NonNullable<Message['toolCalls']>[number],
        activeWorkspacePath: string | undefined,
        translate: (key: string) => string,
        activeChatId?: string
    ) => Promise<{
        toolMessage: Message;
        generatedImages: string[];
    }>
): Promise<{ toolResults: Message[]; generatedImages: string[] }> {
    const toolResults: Message[] = [];
    const generatedImages: string[] = [];

    for (const toolCall of toolCalls) {
        try {
            const executedTool = await executeToolCall(toolCall, workspacePath, t, chatId);
            generatedImages.push(...executedTool.generatedImages);
            toolResults.push(executedTool.toolMessage);
            accumulatedMessages.push(executedTool.toolMessage);
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
        }
    }

    return { toolResults, generatedImages };
}
