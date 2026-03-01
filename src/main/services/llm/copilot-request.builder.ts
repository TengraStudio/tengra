import { randomUUID } from 'crypto';

import { appLogger } from '@main/logging/logger';
import { sanitizePrompt, validatePromptSafety } from '@main/utils/prompt-sanitizer.util';
import { Message, ToolDefinition } from '@shared/types/chat';
import { JsonObject } from '@shared/types/common';

import {
    COPILOT_API_VERSION,
    COPILOT_DEFAULT_TEMPERATURE,
    COPILOT_EDITOR_PLUGIN_VERSION,
    COPILOT_USER_AGENT,
    CopilotPayload,
    CopilotState,
    CopilotTool} from './copilot.types';

const SERVICE_NAME = 'CopilotRequestBuilder';

/**
 * Builds HTTP headers, payloads, and prepares tools for Copilot API requests.
 */
export class CopilotRequestBuilder {
    constructor(private state: CopilotState) {}

    /** Builds standard Copilot API headers */
    getHeaders(token: string, hasImages: boolean = false): Record<string, string> {
        const headers: Record<string, string> = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Copilot-Integration-Id': 'vscode-chat',
            'Editor-Version': `vscode/${this.state.vsCodeVersion}`,
            'Editor-Plugin-Version': COPILOT_EDITOR_PLUGIN_VERSION,
            'User-Agent': COPILOT_USER_AGENT,
            'Openai-Intent': 'conversation-panel',
            'X-GitHub-Api-Version': COPILOT_API_VERSION,
            'X-Request-Id': randomUUID(),
            'X-Vscode-User-Agent-Library-Version': 'electron-fetch',
            'Openai-Organization': 'github-copilot'
        };

        if (hasImages) {
            headers['X-Copilot-Chat-Capability-Image-Vision'] = 'true';
        }

        return headers;
    }

    /** Converts ToolDefinition[] to CopilotTool[] format */
    prepareTools(tools?: ToolDefinition[]): CopilotTool[] | undefined {
        if (!tools || tools.length === 0) {
            return undefined;
        }
        return tools.map(tool => {
            const params = tool.function.parameters ? { ...tool.function.parameters as JsonObject } : {};
            if (params.required) {
                delete params.required;
            }

            return {
                type: 'function' as const,
                function: {
                    name: tool.function.name,
                    description: tool.function.description ?? '',
                    parameters: params
                }
            };
        });
    }

    /** Resolves model name by stripping copilot-/github- prefixes */
    resolveCopilotModel(model: string): string {
        if (model.startsWith('copilot-')) { return model.replace('copilot-', ''); }
        if (model.startsWith('github-')) { return model.replace('github-', ''); }
        return model;
    }

    /** SEC-021: Sanitizes user messages to prevent prompt injection */
    sanitizeUserMessages(messages: Message[]): Message[] {
        return messages.map(msg => {
            if (msg.role !== 'user' || typeof msg.content !== 'string') {
                return msg;
            }
            const validation = validatePromptSafety(msg.content);
            if (!validation.safe) {
                appLogger.warn(SERVICE_NAME, `Prompt safety check failed: ${validation.reason}`);
            }
            return { ...msg, content: sanitizePrompt(msg.content) };
        });
    }

    /** Builds the chat completion payload */
    buildChatPayload(
        messages: Message[],
        model: string,
        stream: boolean,
        token: string,
        tools?: ToolDefinition[]
    ): { headers: Record<string, string>; payload: CopilotPayload; finalModel: string } {
        const sanitizedMessages = this.sanitizeUserMessages(messages);

        const hasImages = sanitizedMessages.some(m => {
            if (Array.isArray(m.content)) {
                return m.content.some(c => c.type === 'image_url');
            }
            return false;
        });

        const finalModel = this.resolveCopilotModel(model);
        const isAgentCall = sanitizedMessages.some(msg => ['assistant', 'tool'].includes(msg.role));
        const headers = this.getHeaders(token, hasImages);
        headers['X-Initiator'] = isAgentCall ? 'agent' : 'user';

        const payload: CopilotPayload = {
            messages: sanitizedMessages,
            model: finalModel,
            stream,
            temperature: COPILOT_DEFAULT_TEMPERATURE
        };

        const preparedTools = this.prepareTools(tools);
        if (preparedTools && preparedTools.length > 0) {
            payload.tools = preparedTools;
            payload.tool_choice = 'auto';
        }

        if (stream) {
            payload.stream_options = { include_usage: true };
        }

        return { headers, payload, finalModel };
    }

    /** Formats messages into a codex-style prompt string */
    formatCodexPrompt(messages: Message[]): string {
        return messages.map(msg => {
            const role = msg.role === 'user' ? 'User' : (msg.role === 'system' ? 'System' : 'Assistant');
            const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
            return `${role}: ${content}`;
        }).join('\n') + '\nAssistant:';
    }
}
