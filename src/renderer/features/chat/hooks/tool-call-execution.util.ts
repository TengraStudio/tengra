import { safeJsonParse } from '@shared/utils/sanitize.util';

import { generateId } from '@/lib/utils';
import { Message } from '@/types';

import { normalizeToolArgs } from './chat-runtime-policy.util';

export async function executeToolCall(
    toolCall: NonNullable<Message['toolCalls']>[number],
    activeWorkspacePath: string | undefined,
    t: (key: string) => string,
    readToolResultImages: (toolExecResult: unknown) => string[],
    chatId?: string
): Promise<{
    toolMessage: Message;
    generatedImages: string[];
}> {
    const toolArgs = typeof toolCall.function.arguments === 'string'
        ? toolCall.function.arguments.length > 100000
            ? (() => { throw new Error(t('chat.toolArgumentsTooLarge')); })()
            : safeJsonParse(toolCall.function.arguments, {})
        : toolCall.function.arguments;

    const normalizedArgs = normalizeToolArgs(toolArgs);
    if (
        (toolCall.function.name === 'execute_command' || toolCall.function.name === 'command_execute') &&
        typeof normalizedArgs.cwd !== 'string' &&
        typeof activeWorkspacePath === 'string' &&
        activeWorkspacePath.trim().length > 0
    ) {
        normalizedArgs.cwd = activeWorkspacePath;
    }

    const toolExecResult = await window.electron.executeTools(
        toolCall.function.name,
        normalizedArgs as Record<string, unknown>,
        toolCall.id,
        chatId
    );

    const generatedImages = toolCall.function.name === 'generate_image'
        ? readToolResultImages(toolExecResult)
        : [];
    const toolResultContent = toolExecResult.success
        ? (
            toolExecResult.result
            || (Array.isArray(toolExecResult.data) ? toolExecResult.data : toolExecResult.data)
            || {}
        )
        : {
            success: false,
            error: toolExecResult.error ?? t('chat.error'),
            errorType: toolExecResult.errorType ?? 'unknown',
            tool: toolCall.function.name,
        };

    let finalContent = JSON.stringify(toolResultContent);
    if (toolExecResult.success) {
        const isActuallyEmpty =
            (Array.isArray(toolResultContent) && toolResultContent.length === 0) ||
            (typeof toolResultContent === 'object' && Object.keys(toolResultContent as object).length === 0);

        if (isActuallyEmpty) {
            finalContent = JSON.stringify({
                ...(Array.isArray(toolResultContent) ? { items: [] } : {}),
                _hint: 'The result is empty. The directory may be empty or the file might be blank. Do NOT hallucinate content that is not present in this result.',
            });
        }
    }

    return {
        toolMessage: {
            id: generateId(),
            role: 'tool',
            content: finalContent,
            toolCallId: toolCall.id,
            timestamp: new Date(),
        },
        generatedImages,
    };
}
