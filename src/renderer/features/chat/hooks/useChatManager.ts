import { useAttachments } from '@renderer/features/chat/hooks/useAttachments';
import { useChatCRUD } from '@renderer/features/chat/hooks/useChatCRUD';
import { useChatGenerator } from '@renderer/features/chat/hooks/useChatGenerator';
import { useFolderManager } from '@renderer/features/chat/hooks/useFolderManager';
import { usePromptManager } from '@renderer/features/chat/hooks/usePromptManager';
import { useSpeechRecognition } from '@renderer/features/chat/hooks/useSpeechRecognition';
import { useSessionState } from '@renderer/hooks/useSessionState';
import { WORKSPACE_AGENT_METADATA_KEY } from '@shared/constants/defaults';
import type { SessionConversationGenerationStatus } from '@shared/types/session-conversation';
import {
    WORKSPACE_AGENT_CHAT_TYPE,
    type WorkspaceAgentPermissionPolicy,
} from '@shared/types/workspace-agent-session';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';

import { generateId } from '@/lib/utils';
import { AppSettings, Chat, Message } from '@/types';
import { CatchError } from '@/types/common';
import { appLogger } from '@/utils/renderer-logger';

/** Maximum messages to keep in memory per chat to prevent memory leaks */
const MAX_MESSAGES_IN_MEMORY = 100;

/** Maximum chats to keep in memory */
const MAX_CHATS_IN_MEMORY = 50;

interface SelectedModelInfo { provider: string; model: string }

interface UseChatManagerOptions {
    selectedModel: string;
    selectedProvider: string;
    selectedModels?: SelectedModelInfo[];
    language: string;
    selectedPersona?: { id: string; name: string; description: string; prompt: string } | null | undefined;
    appSettings?: AppSettings | undefined;
    autoReadEnabled: boolean;
    handleSpeak: (id: string, text: string) => void;
    formatChatError: (err: CatchError) => string;
    t: (key: string, options?: Record<string, unknown>) => string;
    activeWorkspacePath?: string | undefined;
    workspaceId?: string | undefined;
}

/**
 * Trims messages to prevent memory bloat in long-running sessions.
 * Keeps only the most recent messages up to MAX_MESSAGES_IN_MEMORY.
 */
function trimMessages(messages: Message[]): Message[] {
    if (messages.length <= MAX_MESSAGES_IN_MEMORY) {
        return messages;
    }
    return messages.slice(-MAX_MESSAGES_IN_MEMORY);
}

/**
 * Trims chats to prevent memory bloat.
 * Keeps only the most recent chats up to MAX_CHATS_IN_MEMORY.
 */
function trimChats(chats: Chat[]): Chat[] {
    if (chats.length <= MAX_CHATS_IN_MEMORY) {
        return chats;
    }
    // Sort by updatedAt and keep most recent
    return [...chats]
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, MAX_CHATS_IN_MEMORY);
}

function isWorkspaceAgentChat(chat: Chat): boolean {
    // Only treat as workspace-agent chat when explicitly marked as that chat type.
    // Presence of workspaceAgentSession metadata alone is not enough because
    // permission policy metadata can exist on normal chats.
    return (
        chat.metadata?.chatType === WORKSPACE_AGENT_CHAT_TYPE
    );
}

function readChatPermissionPolicy(chat: Chat): WorkspaceAgentPermissionPolicy | null {
    const metadataEntry = chat.metadata?.[WORKSPACE_AGENT_METADATA_KEY];
    if (!metadataEntry || Array.isArray(metadataEntry) || typeof metadataEntry !== 'object') {
        return null;
    }

    // SAFETY: metadata structure for permissions is deep
    const candidate = (metadataEntry as Record<string, unknown>)?.permissionPolicy as Record<string, unknown> | undefined;
    if (!candidate || typeof candidate !== 'object') {
        return null;
    }

    const commandPolicy =
        candidate.commandPolicy === 'blocked' ||
        candidate.commandPolicy === 'ask-every-time' ||
        candidate.commandPolicy === 'allowlist' ||
        candidate.commandPolicy === 'full-access'
            ? candidate.commandPolicy
            : null;
    const pathPolicy =
        candidate.pathPolicy === 'workspace-root-only' ||
        candidate.pathPolicy === 'allowlist' ||
        candidate.pathPolicy === 'restricted-off-dangerous'
            ? candidate.pathPolicy
            : null;

    if (!commandPolicy || !pathPolicy) {
        return null;
    }

    return {
        commandPolicy,
        pathPolicy,
        allowedCommands: Array.isArray(candidate.allowedCommands)
            ? (candidate.allowedCommands as unknown[]).filter(
                (value: unknown): value is string =>
                    typeof value === 'string' && value.trim().length > 0
            )
            : [],
        disallowedCommands: Array.isArray(candidate.disallowedCommands)
            ? (candidate.disallowedCommands as unknown[]).filter(
                (value: unknown): value is string =>
                    typeof value === 'string' && value.trim().length > 0
            )
            : [],
        allowedPaths: Array.isArray(candidate.allowedPaths)
            ? (candidate.allowedPaths as unknown[]).filter(
                (value: unknown): value is string =>
                    typeof value === 'string' && value.trim().length > 0
            )
            : [],
    };
}

function isImageOnlyModel(modelId: string): boolean {
    const normalizedModelId = modelId.trim().toLowerCase();
    return [
        'gemini-3.1-flash-image',
        'gemini-3.1-flash-image-preview',
        'gemini-3-pro-image',
        'gemini-3-pro-image-preview',
        'gemini-2.5-flash-image',
        'gemini-2.5-flash-image-preview',
        'imagen-3.0-generate-001'
    ].some(pattern => normalizedModelId.includes(pattern));
}

function toTextContent(content: Message['content']): string {
    if (typeof content === 'string') {
        return content;
    }
    if (!Array.isArray(content)) {
        return '';
    }
    return content
        .map(part => {
            if (typeof part === 'string') {
                return part;
            }
            if (part?.type === 'text') {
                return part.text ?? '';
            }
            return '';
        })
        .join('')
        .trim();
}

function buildAttachmentPromptContext(
    attachments: ReturnType<typeof useAttachments>['attachments'],
    attachmentLabelTemplate: string
): string {
    const nonImageAttachments = attachments.filter(att => att.type !== 'image');
    if (nonImageAttachments.length === 0) {
        return '';
    }
    return nonImageAttachments
        .map(att => {
            const summary = (att.content ?? '').trim();
            const safeSummary = summary.length > 5000 ? `${summary.slice(0, 5000)}...` : summary;
            const attachmentLabel = attachmentLabelTemplate.replace('{{name}}', att.name);
            return `\n[${attachmentLabel}]\n${safeSummary}`;
        })
        .join('\n');
}

function useChatInitialization(loadFolders: () => Promise<void>, setChats: React.Dispatch<React.SetStateAction<Chat[]>>): void {
    useEffect(() => {
        const load = async () => {
            try {
                const allChats = await window.electron.db.getAllChats();
                const visibleChats = (allChats as Chat[]).filter(
                    chat => !isWorkspaceAgentChat(chat)
                );
                const trimmedChats = trimChats(
                    visibleChats.map(chat => ({
                        ...chat,
                        messages: []
                    }))
                );
                setChats(trimmedChats);
                await loadFolders();
            } catch (error) {
                appLogger.error('ChatManager', 'Failed to initialize chats', error as Error);
            }
        };
        void load();

        const removeStatusListener = window.electron.session.conversation.onGenerationStatus((data: SessionConversationGenerationStatus) => {
            setChats(prev => prev.map(c => c.id === data.chatId ? { ...c, isGenerating: data.isGenerating } : c));
        });
        return () => { removeStatusListener(); };
    }, [loadFolders, setChats]);
}

function useLazyMessageLoader(currentChatId: string | null, chats: Chat[], setChats: React.Dispatch<React.SetStateAction<Chat[]>>): void {
    useEffect(() => {
        if (!currentChatId) { return; }
        const targetChat = chats.find(c => c.id === currentChatId);
        if (targetChat?.messages.length !== 0) { return; }

        const fetchMessages = async () => {
            try {
                const messages = await window.electron.db.getMessages(currentChatId);
                const trimmedMessages = trimMessages(messages as Message[]);
                setChats(prev => prev.map(c => {
                    if (c.id !== currentChatId || c.messages.length > 0) {
                        return c;
                    }
                    return { ...c, messages: trimmedMessages };
                }));
            } catch (e) {
                appLogger.error('ChatManager', `Failed to load messages for ${currentChatId}`, e as Error);
            }
        };
        void fetchMessages();
    }, [currentChatId, chats, setChats]);
}

export function useChatManager(options: UseChatManagerOptions) {
    const { 
        selectedModel, 
        selectedProvider, 
        language, 
        selectedPersona, 
        appSettings, 
        autoReadEnabled, 
        handleSpeak, 
        formatChatError, 
        t,
        activeWorkspacePath,
        workspaceId
    } = options;

    const [chats, setChats] = useState<Chat[]>([]);
    const [currentChatId, setCurrentChatId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [input, setInput] = useState('');
    const [contextTokens] = useState(0);

    const [systemMode, setSystemMode] = useState<'thinking' | 'agent' | 'fast'>('agent');
    const [imageRequestCount, setImageRequestCount] = useState(1);
    const [permissionPolicy, setPermissionPolicy] = useState<WorkspaceAgentPermissionPolicy>({
        commandPolicy: 'ask-every-time',
        pathPolicy: 'workspace-root-only',
        allowedCommands: [],
        disallowedCommands: [],
        allowedPaths: []
    });
    const prevChatIdRef = useRef<string | null>(null);

    useEffect(() => {
        if (!appSettings) {
            return;
        }
        
        const newPolicy = {
            commandPolicy: appSettings.general.agentCommandPolicy ?? 'ask-every-time',
            pathPolicy: appSettings.general.agentPathPolicy ?? 'workspace-root-only',
            allowedCommands: appSettings.general.agentAllowedCommands ?? [],
            disallowedCommands: appSettings.general.agentDisallowedCommands ?? [],
            allowedPaths: appSettings.general.agentAllowedPaths ?? []
        };
        
        const rafId = requestAnimationFrame(() => {
            setPermissionPolicy(prev => {
                if (JSON.stringify(prev) === JSON.stringify(newPolicy)) {
                    return prev;
                }
                return newPolicy;
            });
        });

        return () => cancelAnimationFrame(rafId);
    }, [appSettings]);

    const { prompts, createPrompt, deletePrompt, updatePrompt } = usePromptManager();
    const { streamingStates, lastChatError, clearChatError, generateResponse, stopGeneration } = useChatGenerator({
        chats, setChats, appSettings, selectedModel, selectedProvider, selectedModels: options.selectedModels,
        language, selectedPersona, activeWorkspacePath, workspaceId,
        t, handleSpeak, autoReadEnabled, formatChatError, systemMode
    });
    const { folders, loadFolders, createFolder, updateFolder, deleteFolder: baseDeleteFolder } = useFolderManager();
    const { isListening, startListening, stopListening } = useSpeechRecognition(language, (text) => { setInput(prev => (prev.trim() ? `${prev} ${text} ` : text)); });
    const { createNewChat, deleteChat, clearMessages, deleteFolder, moveChatToFolder, addMessage, updateChat, togglePin, toggleFavorite, bulkDeleteChats } = useChatCRUD({ currentChatId, setCurrentChatId, setChats, setInput, baseDeleteFolder });
    const { attachments, setAttachments, processFile, removeAttachment } = useAttachments();

    useEffect(() => {
        if (!currentChatId) {
            return;
        }
        const chat = chats.find(c => c.id === currentChatId);
        if (!chat) {
            return;
        }

        const existingPolicy = readChatPermissionPolicy(chat);
        if (JSON.stringify(existingPolicy) !== JSON.stringify(permissionPolicy)) {
            const existingMetadataEntry =
                chat.metadata?.[WORKSPACE_AGENT_METADATA_KEY] &&
                !Array.isArray(chat.metadata[WORKSPACE_AGENT_METADATA_KEY]) &&
                typeof chat.metadata[WORKSPACE_AGENT_METADATA_KEY] === 'object'
                    // SAFETY: metadata structure for workspace agent is dynamic
                    ? chat.metadata[WORKSPACE_AGENT_METADATA_KEY] as Record<string, unknown>
                    : {};

            void updateChat(currentChatId, {
                metadata: {
                    ...(chat.metadata || {}),
                    [WORKSPACE_AGENT_METADATA_KEY]: {
                        ...existingMetadataEntry,
                        permissionPolicy,
                    }
                }
            });
        }
    }, [permissionPolicy, currentChatId, chats, updateChat]);

    useEffect(() => {
        if (!currentChatId || prevChatIdRef.current === currentChatId) {
            if (!currentChatId) {
                prevChatIdRef.current = null;
            }
            return;
        }
        prevChatIdRef.current = currentChatId;

        const chat = chats.find(c => c.id === currentChatId);
        const policy = chat ? readChatPermissionPolicy(chat) : null;
        if (policy) {
            const rafId = requestAnimationFrame(() => {
                setPermissionPolicy(prev => {
                    if (JSON.stringify(prev) === JSON.stringify(policy)) {
                        return prev;
                    }
                    return policy;
                });
            });
            return () => cancelAnimationFrame(rafId);
        }
        
        if (appSettings) {
            const rafId = requestAnimationFrame(() => {
                setPermissionPolicy({
                    commandPolicy: appSettings.general.agentCommandPolicy ?? 'ask-every-time',
                    pathPolicy: appSettings.general.agentPathPolicy ?? 'workspace-root-only',
                    allowedCommands: appSettings.general.agentAllowedCommands ?? [],
                    disallowedCommands: appSettings.general.agentDisallowedCommands ?? [],
                    allowedPaths: appSettings.general.agentAllowedPaths ?? []
                });
            });
            return () => cancelAnimationFrame(rafId);
        }
        return undefined;
    }, [currentChatId, chats, appSettings]);

    useChatInitialization(loadFolders, setChats);
    useLazyMessageLoader(currentChatId, chats, setChats);

    useEffect(() => {
        if (prevChatIdRef.current !== null && prevChatIdRef.current !== currentChatId) {
            setChats(prev => prev.map(c =>
                c.id === prevChatIdRef.current && c.messages.length > MAX_MESSAGES_IN_MEMORY
                    ? { ...c, messages: trimMessages(c.messages) }
                    : c
            ));
        }
        prevChatIdRef.current = currentChatId;
    }, [currentChatId, setChats]);

    const currentChat = chats.find(c => c.id === currentChatId);
    const currentSessionState = useSessionState(currentChatId);
    const currentStreamState = currentChatId ? streamingStates[currentChatId] : undefined;
    const streamingReasoning = useMemo(() => currentStreamState?.reasoning ?? '', [currentStreamState]);
    const streamingSpeed = useMemo(() => currentStreamState?.speed ?? null, [currentStreamState]);
    const chatError = useMemo(() => {
        if (!currentChatId) { return lastChatError; }
        return currentStreamState?.error ?? lastChatError;
    }, [currentStreamState, lastChatError, currentChatId]);
    const isLoading = useMemo(() => {
        const sessionStatus = currentSessionState?.status;
        const sessionLoading = sessionStatus === 'preparing' || sessionStatus === 'streaming';
        return currentChatId
            ? Boolean(currentChat?.isGenerating) || Boolean(currentStreamState) || sessionLoading
            : false;
    }, [currentChatId, currentChat?.isGenerating, currentSessionState?.status, currentStreamState]);
    const messages = useMemo(() => currentChat?.messages ?? [], [currentChat]);
    const deferredSearchTerm = useDeferredValue(searchTerm);
    const normalizedSearchTerm = useMemo(() => deferredSearchTerm.trim().toLowerCase(), [deferredSearchTerm]);
    const messageSearchIndex = useMemo(() => {
        const index = new Map<string, string>();
        for (const message of messages) {
            index.set(
                message.id,
                (typeof message.content === 'string' ? message.content : '').toLowerCase()
            );
        }
        return index;
    }, [messages]);
    const displayMessages = useMemo(
        () =>
            normalizedSearchTerm === ''
                ? messages
                : messages.filter(message =>
                    (messageSearchIndex.get(message.id) ?? '').includes(normalizedSearchTerm)
                ),
        [messages, messageSearchIndex, normalizedSearchTerm]
    );

    const handleSend = useCallback(async (customInput?: string) => {
        const content = customInput ?? input;
        const readyAttachments = attachments.filter(att => att.status === 'ready');
        const hasInputText = content.trim() !== '';
        const hasReadyAttachments = readyAttachments.length > 0;
        if ((!hasInputText && !hasReadyAttachments) || !selectedModel || isLoading) { return; }

        setChats(prev => prev.map(c => c.id === currentChatId ? { ...c, isGenerating: true } : c));
        setInput('');
        let chatId = currentChatId;
        if (!chatId) {
            const newChatId = generateId();
            const timestamp = Date.now();
            const newChatDb = { id: newChatId, title: content.slice(0, 50), model: selectedModel, backend: selectedProvider as string, createdAt: timestamp, updatedAt: timestamp, isGenerating: true };
            const createResult = await window.electron.db.createChat(newChatDb);
            if (!createResult.success) {
                appLogger.error('ChatManager', '[useChatManager] Failed to create chat');
                setChats(prev => prev.map(c => c.id === currentChatId ? { ...c, isGenerating: false } : c));
                return;
            }
            setChats(prev => [{ ...newChatDb, messages: [], createdAt: new Date(timestamp), updatedAt: new Date(timestamp), isGenerating: true }, ...prev]);
            chatId = newChatId;
            setCurrentChatId(chatId);
        }

        const timestamp = Date.now();
        const imageInputs = readyAttachments.flatMap(att => {
            if (att.type === 'image' && typeof att.content === 'string' && att.content.startsWith('data:image/')) {
                return [att.content];
            }
            if (att.type === 'video' && typeof att.preview === 'string' && att.preview.startsWith('data:image/')) {
                return [att.preview];
            }
            return [];
        });
        const attachmentContext = buildAttachmentPromptContext(
            readyAttachments,
            t('chat.attachmentPrompt.label')
        );
        const mergedContent = hasInputText
            ? `${content}${attachmentContext}`
            : `${attachmentContext}\n[${t('chat.attachmentPrompt.analyzeMedia')}]`.trim();
        const userMessage: Message = {
            id: generateId(),
            role: 'user',
            content: mergedContent,
            timestamp: new Date(timestamp),
            images: imageInputs.length > 0 ? imageInputs : undefined,
            metadata: isImageOnlyModel(selectedModel)
                ? { imageRequestCount }
                : undefined
        };
        if (!chatId) { throw new Error('CHAT_ID_CREATION_FAILED'); }
        await window.electron.db.addMessage({ ...userMessage, chatId, timestamp, provider: selectedProvider, model: selectedModel });
        setChats(prev =>
            prev.map((c: Chat) =>
                c.id === chatId
                    ? {
                        ...c,
                        messages: [...c.messages, userMessage],
                        title: c.messages.length === 0 ? mergedContent.slice(0, 50) : c.title
                    }
                    : c
            )
        );
        setAttachments([]);
        void generateResponse(chatId, userMessage);
    }, [input, attachments, selectedModel, isLoading, currentChatId, selectedProvider, generateResponse, imageRequestCount, setChats, setAttachments, t]);

    const regenerateMessage = useCallback(
        async (assistantMessageId: string) => {
            if (!currentChatId || isLoading) {
                return;
            }
            const chat = chats.find(c => c.id === currentChatId);
            if (!chat) {
                return;
            }

            const assistantIndex = chat.messages.findIndex(
                m => m.id === assistantMessageId && m.role === 'assistant'
            );
            if (assistantIndex <= 0) {
                return;
            }

            const previousUserMessage = [...chat.messages.slice(0, assistantIndex)]
                .reverse()
                .find(m => m.role === 'user');
            const prompt = previousUserMessage ? toTextContent(previousUserMessage.content) : '';
            if (!prompt) {
                return;
            }

            await handleSend(prompt);
        },
        [currentChatId, isLoading, chats, handleSend]
    );

    return useMemo(() => ({
        chats, setChats, currentChatId, setCurrentChatId, messages, displayMessages, searchTerm, setSearchTerm, input, setInput, isLoading,
        streamingReasoning, streamingSpeed, chatError, clearChatError, contextTokens, handleSend, stopGeneration, createNewChat, deleteChat, clearMessages,
        folders, createFolder, updateFolder, deleteFolder, moveChatToFolder, addMessage, prompts, createPrompt, deletePrompt, updatePrompt,
        isListening, startListening, stopListening, updateChat, togglePin, toggleFavorite, attachments, setAttachments, processFile, removeAttachment,
        t, handleSpeak, systemMode, setSystemMode, imageRequestCount, setImageRequestCount, regenerateMessage, bulkDeleteChats,
        permissionPolicy, setPermissionPolicy
    }), [chats, currentChatId, messages, displayMessages, searchTerm, input, isLoading, streamingReasoning, streamingSpeed, chatError, clearChatError, contextTokens,
        handleSend, stopGeneration, createNewChat, deleteChat, clearMessages, folders, createFolder, updateFolder, deleteFolder, moveChatToFolder,
        addMessage, prompts, createPrompt, deletePrompt, updatePrompt, isListening, startListening, stopListening, updateChat, togglePin, toggleFavorite,
        attachments, setAttachments, processFile, removeAttachment, t, handleSpeak, systemMode, imageRequestCount, regenerateMessage, bulkDeleteChats,
        permissionPolicy, setPermissionPolicy]);
}
