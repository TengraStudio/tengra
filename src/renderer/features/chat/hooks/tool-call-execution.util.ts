/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { safeJsonParse } from '@shared/utils/sanitize.util';

import { generateId } from '@/lib/utils';
import { Message } from '@/types';
import { JsonValue } from '@/types/common';
import { appLogger } from '@/utils/renderer-logger';

import { normalizeToolArgs } from './chat-runtime-policy.util';

interface ToolExecutionResponse {
    success: boolean;
    result?: JsonValue;
    data?: JsonValue;
    error?: string;
    errorType?: string;
}

const TOOL_EXECUTION_TIMEOUT_DEFAULT_MS = 45000;
const TOOL_EXECUTION_TIMEOUT_BY_NAME = new Map<string, number>([
    ['execute_command', 190000],
    ['generate_image', 120000],
    ['terminal_session_wait', 190000],
]);

function resolveToolExecutionTimeoutMs(
    toolName: string,
    args: Record<string, unknown>
): number {
    const baseTimeoutMs = TOOL_EXECUTION_TIMEOUT_BY_NAME.get(toolName) ?? TOOL_EXECUTION_TIMEOUT_DEFAULT_MS;

    if (toolName === 'terminal_session_wait') {
        const requested = args.timeoutMs;
        if (typeof requested === 'number' && Number.isFinite(requested)) {
            const bounded = Math.max(1000, Math.min(Math.floor(requested) + 5000, 130000));
            return bounded;
        }
    }

    return baseTimeoutMs;
}

async function withTimeout<T>(operation: Promise<T>, timeoutMs: number, message: string): Promise<T> {
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => reject(new Error(message)), timeoutMs);
    });

    try {
        return await Promise.race([operation, timeoutPromise]);
    } finally {
        if (timeoutHandle) {
            clearTimeout(timeoutHandle);
        }
    }
}

const NON_EMPTY_STRING_REQUIRED_ARGUMENTS = new Map<string, string[]>([
    ['resolve_path', ['path']],
    ['write_file', ['path', 'content']],
    ['patch_file', ['path']],
    ['search_files', ['rootPath', 'pattern']],
    ['create_directory', ['path']],
    ['delete_file', ['path']],
    ['file_exists', ['path']],
    ['get_file_info', ['path']],
    ['list_directory', ['path']],
    ['list_dir', ['path']],
    ['read_file', ['path']],
    ['move_file', ['source', 'destination']],
    ['copy_file', ['source', 'destination']],
    ['execute_command', ['command']],
    ['terminal_session_write', ['sessionId', 'input']],
    ['terminal_session_read', ['sessionId']],
    ['terminal_session_wait', ['sessionId']],
    ['terminal_session_signal', ['sessionId']],
    ['terminal_session_stop', ['sessionId']],
    ['terminal_session_snapshot', ['sessionId']],
]);

function buildValidationFailure(
    toolName: string,
    missingArgument: string,
    details?: Record<string, unknown>
): ToolExecutionResponse {
    return {
        success: false,
        error: `Tool '${toolName}' requires a valid '${missingArgument}' argument. Do not retry the same incomplete call; infer or resolve the missing value first.`,
        errorType: 'invalid_args',
        result: {
            success: false,
            resultKind: 'tool_argument_validation',
            tool: toolName,
            missingArgument,
            complete: false,
            retrySameCall: false,
            ...(details ?? {}),
        },
    };
}

function buildToolMessage(
    toolCall: NonNullable<Message['toolCalls']>[number],
    content: JsonValue
): Message {
    return {
        id: generateId(),
        role: 'tool',
        content: JSON.stringify(content),
        toolCallId: toolCall.id,
        timestamp: new Date(),
    };
}

function validateToolArguments(
    toolName: string,
    args: Record<string, unknown>
): ToolExecutionResponse | null {
    const requiredStringArguments = NON_EMPTY_STRING_REQUIRED_ARGUMENTS.get(toolName) ?? [];
    for (const argumentName of requiredStringArguments) {
        const value = args[argumentName];
        if (typeof value !== 'string' || value.trim().length === 0) {
            return buildValidationFailure(toolName, argumentName);
        }
    }

    if (toolName === 'write_files') {
        const files = args.files;
        if (!Array.isArray(files) || files.length === 0) {
            return buildValidationFailure(toolName, 'files');
        }
        const invalidFileIndex = files.findIndex(file =>
            !file
            || typeof file !== 'object'
            || Array.isArray(file)
            || typeof (file as Record<string, unknown>).path !== 'string'
            || ((file as Record<string, unknown>).path as string).trim().length === 0
            || typeof (file as Record<string, unknown>).content !== 'string'
        );
        if (invalidFileIndex !== -1) {
            return buildValidationFailure(toolName, 'files', { invalidItemIndex: invalidFileIndex });
        }
    }

    if (toolName === 'read_many_files') {
        const paths = args.paths;
        if (!Array.isArray(paths) || paths.length === 0) {
            return buildValidationFailure(toolName, 'paths');
        }
        const invalidPathIndex = paths.findIndex(path => typeof path !== 'string' || path.trim().length === 0);
        if (invalidPathIndex !== -1) {
            return buildValidationFailure(toolName, 'paths', { invalidItemIndex: invalidPathIndex });
        }
    }

    if (toolName === 'patch_file') {
        const hasEdits = Array.isArray(args.edits) && args.edits.length > 0;
        const hasSearchReplace = typeof args.search === 'string' && args.search.length > 0 && typeof args.replace === 'string';
        if (!hasEdits && !hasSearchReplace) {
            return buildValidationFailure(toolName, 'edits', { alternativeAccepted: 'search+replace' });
        }
    }

    return null;
}

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
    const executionStartAt = Date.now();
    const toolArgs = typeof toolCall.function.arguments === 'string'
        ? toolCall.function.arguments.length > 100000
            ? (() => { throw new Error(t('frontend.chat.toolArgumentsTooLarge')); })()
            : safeJsonParse(toolCall.function.arguments, {})
        : toolCall.function.arguments;

    const normalizedArgs = normalizeToolArgs(toolArgs);

    // When a workspace is active, make filesystem tools resolve relative paths from the workspace root.
    // If no workspace is active, the main process will fall back to the user's Desktop/Home.
    if (
        typeof activeWorkspacePath === 'string'
        && activeWorkspacePath.trim().length > 0
        && typeof normalizedArgs.basePath !== 'string'
        && typeof toolCall.function?.name === 'string'
        && (
            toolCall.function.name.startsWith('mcp__filesystem__')
            || toolCall.function.name === 'read_file'
            || toolCall.function.name === 'write_file'
            || toolCall.function.name === 'write_files'
            || toolCall.function.name === 'list_directory'
            || toolCall.function.name === 'list_dir'
            || toolCall.function.name === 'search_files'
        )
    ) {
        normalizedArgs.basePath = activeWorkspacePath;
    }
    const validationFailure = validateToolArguments(toolCall.function.name, normalizedArgs);
    if (validationFailure) {
        return {
            toolMessage: buildToolMessage(toolCall, {
                success: false,
                error: validationFailure.error ?? t('frontend.chat.error'),
                errorType: validationFailure.errorType ?? 'invalid_args',
                tool: toolCall.function.name,
                details: validationFailure.result,
            }),
            generatedImages: [],
        };
    }
    if (
        (toolCall.function.name === 'execute_command' || toolCall.function.name === 'command_execute') &&
        typeof normalizedArgs.cwd !== 'string' &&
        typeof activeWorkspacePath === 'string' &&
        activeWorkspacePath.trim().length > 0
    ) {
        normalizedArgs.cwd = activeWorkspacePath;
    }

    const toolTimeoutMs = resolveToolExecutionTimeoutMs(toolCall.function.name, normalizedArgs as Record<string, unknown>);
    appLogger.info(
        'tool-call-execution',
        `executeToolCall:start tool=${toolCall.function.name}, toolCallId=${toolCall.id}, timeoutMs=${toolTimeoutMs}, argKeys=${Object.keys(normalizedArgs).join(',')}`
    );
    const toolExecResult = await withTimeout(
        window.electron.executeTools(
            toolCall.function.name,
            normalizedArgs as Record<string, unknown>,
            toolCall.id,
            chatId
        ) as Promise<ToolExecutionResponse>,
        toolTimeoutMs,
        `Tool '${toolCall.function.name}' timed out after ${toolTimeoutMs}ms`
    );
    appLogger.info(
        'tool-call-execution',
        `executeToolCall:finish tool=${toolCall.function.name}, toolCallId=${toolCall.id}, success=${String(toolExecResult.success)}, durationMs=${Date.now() - executionStartAt}, errorType=${toolExecResult.errorType ?? 'none'}`
    );

    const generatedImages = toolCall.function.name === 'generate_image'
        ? readToolResultImages(toolExecResult)
        : [];
    const toolResultContent = toolExecResult.success
        ? (
            toolExecResult.result
            ?? toolExecResult.data
            ?? {}
        )
        : {
            success: false,
            error: toolExecResult.error ?? t('frontend.chat.error'),
            errorType: toolExecResult.errorType ?? 'unknown',
            tool: toolCall.function.name,
            details: toolExecResult.result ?? toolExecResult.data,
        };

    const finalContent = JSON.stringify(toolResultContent);

    return {
        toolMessage: buildToolMessage(toolCall, safeJsonParse<JsonValue>(finalContent, toolResultContent)),
        generatedImages,
    };
}

