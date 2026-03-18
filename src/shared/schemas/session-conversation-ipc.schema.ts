import { z } from 'zod';

const sessionConversationTextPartSchema = z.object({
    type: z.literal('text'),
    text: z.string(),
});

const sessionConversationImagePartSchema = z.object({
    type: z.literal('image_url'),
    image_url: z.object({
        url: z.string(),
        detail: z.enum(['auto', 'low', 'high']).optional(),
    }),
});

export const sessionConversationMessageContentPartSchema = z.union([
    sessionConversationTextPartSchema,
    sessionConversationImagePartSchema,
]);

/**
 * Schema for a single message in a conversation.
 */
export const sessionConversationMessageSchema = z.object({
    id: z.string().optional(),
    role: z.enum(['system', 'user', 'assistant', 'function', 'tool']),
    content: z.union([
        z.string(),
        z.array(sessionConversationMessageContentPartSchema),
    ]),
    /**
     * Timestamp of the message.
     * Supports ISO string, Date object, or numeric milliseconds.
     * Automatically transformed into a Date object.
     */
    timestamp: z.union([z.string(), z.date(), z.number()]).optional().transform(value => value ? new Date(value) : new Date()),
    name: z.string().optional(),
    tool_calls: z.array(z.record(z.string(), z.unknown())).optional(),
    tool_call_id: z.string().optional(),
});

export const sessionConversationToolDefinitionSchema = z.object({
    type: z.literal('function'),
    function: z.object({
        name: z.string(),
        description: z.string().optional(),
        parameters: z.record(z.string(), z.unknown()).optional(),
    }),
});

export const sessionConversationToolCallSchema = z.object({
    id: z.string(),
    index: z.number().int().nonnegative().optional(),
    type: z.literal('function'),
    function: z.object({
        name: z.string(),
        arguments: z.string(),
    }),
});

export const sessionConversationCompleteRequestSchema = z.object({
    messages: z.array(sessionConversationMessageSchema),
    model: z.string(),
    tools: z.array(sessionConversationToolDefinitionSchema).optional(),
    provider: z.string(),
    workspaceId: z.string().optional(),
    systemMode: z.enum(['thinking', 'agent', 'fast', 'architect']).optional(),
});

export const sessionConversationStreamRequestSchema =
    sessionConversationCompleteRequestSchema.extend({
        chatId: z.string(),
        optionsJson: z.record(z.string(), z.unknown()).optional(),
    });

export const sessionConversationRetryRequestSchema = z.object({
    chatId: z.string(),
    messageId: z.string(),
    model: z.string(),
    provider: z.string(),
});

export const sessionConversationCompleteResponseSchema = z.object({
    content: z.string(),
    toolCalls: z.array(sessionConversationToolCallSchema).optional(),
    reasoning: z.string().optional(),
    images: z.array(z.string()).optional(),
    role: z.literal('assistant'),
    sources: z.array(z.string()).optional(),
});

export const sessionConversationStreamResponseSchema = z.void();

export const sessionConversationRetryResponseSchema = z.union([
    z.boolean(),
    z.void(),
]);
