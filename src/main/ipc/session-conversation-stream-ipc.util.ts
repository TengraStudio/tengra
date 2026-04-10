import { appLogger } from '@main/logging/logger';
import { SESSION_CONVERSATION_CHANNELS } from '@shared/constants/ipc-channels';
import { RuntimeValue } from '@shared/types/common';
import { getErrorMessage } from '@shared/utils/error.util';
import { WebContents } from 'electron';

const STREAM_CHUNK_BINARY_THRESHOLD_BYTES = 4_096;

function safeSend(sender: WebContents, channel: string, ...args: RuntimeValue[]): boolean {
    try {
        if (sender.isDestroyed()) {
            appLogger.warn('IPC', `[IPC:safeSend] sender destroyed before send channel=${channel}`);
            return false;
        }
        sender.send(channel, ...args);
        return true;
    } catch (error) {
        const message = getErrorMessage(error as Error);
        if (!message.includes('EPIPE') && !message.includes('destroyed')) {
            appLogger.error('IPC', `[IPC:safeSend] Failed to send to ${channel}: ${message}`);
        }
        return false;
    }
}

function shouldSendBinaryConversationChunk(chunk: Record<string, RuntimeValue>): boolean {
    const content = typeof chunk.content === 'string' ? chunk.content : '';
    const reasoning = typeof chunk.reasoning === 'string' ? chunk.reasoning : '';
    return content.length + reasoning.length >= STREAM_CHUNK_BINARY_THRESHOLD_BYTES;
}

function encodeConversationChunk(chunk: Record<string, RuntimeValue>): Uint8Array | null {
    try {
        return new TextEncoder().encode(JSON.stringify(chunk));
    } catch (error) {
        appLogger.warn('IPC', 'Failed to encode binary conversation chunk', {
            error: getErrorMessage(error as Error),
        });
        return null;
    }
}

export function safeSendConversationChunk(
    sender: WebContents,
    chunk: Record<string, RuntimeValue>
): boolean {
    const chunkType = typeof chunk.type === 'string' ? chunk.type : 'content';
    const contentLength = typeof chunk.content === 'string' ? chunk.content.length : 0;
    const reasoningLength = typeof chunk.reasoning === 'string' ? chunk.reasoning.length : 0;
    const streamId = typeof chunk.streamId === 'string' ? chunk.streamId : '';
    const chatId = typeof chunk.chatId === 'string' ? chunk.chatId : '';

    if (shouldSendBinaryConversationChunk(chunk)) {
        const encodedChunk = encodeConversationChunk(chunk);
        if (encodedChunk) {
            appLogger.debug(
                'IPC',
                `[IPC:conversation] send-binary chatId=${chatId} streamId=${streamId} type=${chunkType} contentLen=${contentLength} reasoningLen=${reasoningLength} bytes=${encodedChunk.byteLength}`
            );
            return safeSend(
                sender,
                SESSION_CONVERSATION_CHANNELS.STREAM_CHUNK_BINARY,
                encodedChunk
            );
        }
        appLogger.warn(
            'IPC',
            `[IPC:conversation] binary-encode-failed; fallback-json chatId=${chatId} streamId=${streamId} type=${chunkType} contentLen=${contentLength} reasoningLen=${reasoningLength}`
        );
    }

    appLogger.debug(
        'IPC',
        `[IPC:conversation] send-json chatId=${chatId} streamId=${streamId} type=${chunkType} contentLen=${contentLength} reasoningLen=${reasoningLength}`
    );
    return safeSend(sender, SESSION_CONVERSATION_CHANNELS.STREAM_CHUNK, chunk);
}
