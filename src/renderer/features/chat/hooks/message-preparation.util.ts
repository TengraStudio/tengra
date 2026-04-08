import { getSystemPrompt } from '@/lib/identity';
import { generateId } from '@/lib/utils';
import { AppSettings, Chat, Message } from '@/types';

import { formatMessageContent, getPresetOptions } from './utils';

export interface PrepareMessagesOptions {
    chatId: string;
    chats: Chat[];
    userMessage: Message;
    appSettings: AppSettings | undefined;
    selectedModel: string;
    selectedProvider: string;
    language: string;
    selectedPersona?:
    | { id: string; name: string; description: string; prompt: string }
    | null
    | undefined;
    activeWorkspacePath?: string | undefined;
    systemMode: 'thinking' | 'agent' | 'fast';
    toolingEnabled?: boolean | undefined;
}

export function prepareMessages(options: PrepareMessagesOptions): {
    allMessages: Message[];
    presetOptions: Record<string, RendererDataValue>;
} {
    const {
        chatId,
        chats,
        userMessage,
        appSettings,
        selectedModel,
        selectedProvider,
        language,
        selectedPersona,
        activeWorkspacePath,
        systemMode,
        toolingEnabled = systemMode === 'agent',
    } = options;

    const dbRefChat = chats.find(chat => chat.id === chatId);
    const contextMessages = (dbRefChat?.messages ?? []).slice(-15);

    const chatMessages = [...contextMessages, userMessage].map(message => ({
        ...message,
        content: formatMessageContent(message),
    }));

    const modelSettings = appSettings?.modelSettings ?? {};
    const modelConfig = modelSettings[selectedModel] ?? {};
    const systemPrompt =
        modelConfig.systemPrompt ??
        getSystemPrompt(
            language,
            selectedPersona?.prompt,
            selectedProvider,
            selectedModel
        );

    const systemMessage: Message = {
        role: 'system',
        content: systemPrompt,
        id: generateId(),
        timestamp: new Date(),
    };

    const workspaceHintMessage: Message | null =
        toolingEnabled &&
            typeof activeWorkspacePath === 'string' &&
            activeWorkspacePath.trim().length > 0
            ? {
                role: 'system',
                content: `Current workspace root: ${activeWorkspacePath}. Use this as default cwd for terminal_session_start, execute_command, and relative file paths unless the user explicitly requests another location. Prefer persistent terminal sessions for multi-step shell work and dev servers. When creating a new codebase, create a single top-level project folder once and keep all subsequent files/commands inside that same folder unless the user asks for multiple folders.`,
                id: generateId(),
                timestamp: new Date(),
            }
            : null;

    const presetOptions = getPresetOptions(appSettings, modelConfig);

    return {
        allMessages: [systemMessage, ...(workspaceHintMessage ? [workspaceHintMessage] : []), ...chatMessages],
        presetOptions,
    };
}
