/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { WORKSPACE_AGENT_METADATA_KEY } from '@shared/constants/defaults';
import { QuotaResponse } from '@shared/types/quota';
import type { SessionConversationGenerationStatus } from '@shared/types/session-conversation';
import {
    WORKSPACE_AGENT_CHAT_TYPE,
    type WorkspaceAgentPermissionPolicy,
} from '@shared/types/workspace-agent-session';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';

import { deduplicateMessages } from '@/features/chat/hooks/ai-runtime-chat.util';
import { useAttachments } from '@/features/chat/hooks/useAttachments';
import { useChatCRUD } from '@/features/chat/hooks/useChatCRUD';
import { useChatGenerator } from '@/features/chat/hooks/useChatGenerator';
import { useFolderManager } from '@/features/chat/hooks/useFolderManager';
import { usePromptManager } from '@/features/chat/hooks/usePromptManager';
import { useSpeechRecognition } from '@/features/chat/hooks/useSpeechRecognition';
import { getSelectableProviderId } from '@/features/models/utils/model-fetcher';
import { useSessionState } from '@/hooks/useSessionState';
import { generateId } from '@/lib/utils';
import { 
    getChatSnapshot, 
    setChats, 
    setCurrentChatId, 
    updateChatInStore, 
    useChatStore} from '@/store/chat.store';
import { getSettingsSnapshot, updateSettings } from '@/store/settings.store';
import { AppSettings, Chat, Message } from '@/types';
import { CatchError } from '@/types/common';
import { CachedDatabase } from '@/utils/cached-database.util';
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
    appSettings?: AppSettings | undefined;
    autoReadEnabled: boolean;
    handleSpeak: (id: string, text: string) => void;
    formatChatError: (err: CatchError) => string;
    t: (key: string, options?: Record<string, unknown>) => string;
    activeWorkspacePath?: string | undefined;
    workspaceId?: string | undefined;
    models: import('@/types').ModelInfo[];
    quotas?: { accounts: QuotaResponse[] } | null | undefined;
    linkedAccounts?: Array<import('@/electron.d').LinkedAccountInfo> | undefined;
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
    return chat.metadata?.chatType === WORKSPACE_AGENT_CHAT_TYPE;
}

function readChatPermissionPolicy(chat: Chat): WorkspaceAgentPermissionPolicy | null {
    const metadataEntry = chat.metadata?.[WORKSPACE_AGENT_METADATA_KEY];
    if (!metadataEntry || Array.isArray(metadataEntry) || typeof metadataEntry !== 'object') {
        return null;
    }

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
        candidate.pathPolicy === 'restricted-off-dangerous' ||
        candidate.pathPolicy === 'full-access'
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

function getConfiguredOllamaContextWindow(
    appSettings: AppSettings | undefined,
    selectedModel: string
): number | null {
    const modelKey = selectedModel.trim().startsWith('ollama/')
        ? selectedModel.trim()
        : `ollama/${selectedModel.trim()}`;
    const perModel = appSettings?.modelSettings?.[modelKey]?.numCtx;
    if (typeof perModel === 'number' && Number.isFinite(perModel) && perModel > 0) {
        return perModel;
    }
    const globalNumCtx = appSettings?.ollama?.numCtx;
    if (typeof globalNumCtx === 'number' && Number.isFinite(globalNumCtx) && globalNumCtx > 0) {
        return globalNumCtx;
    }
    return null;
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
        .join(' ')
        .replace(/\s+/g, ' ')
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

function resolveActiveModelSelection(options: {
    selectedModel: string;
    selectedProvider: string;
    selectedModels?: SelectedModelInfo[];
    appSettings?: AppSettings | undefined;
    models?: import('@/types').ModelInfo[];
}): { model: string; provider: string } {
    const availableModels = options.models ?? [];
    const hasExactModelProvider = (model: string, provider: string): boolean => {
        if (!model || !provider) {
            return false;
        }
        return availableModels.some(candidate =>
            candidate.id === model && getSelectableProviderId(candidate) === provider
        );
    };

    const firstSelected = options.selectedModels?.[0];
    if (firstSelected?.model && firstSelected.provider) {
        const model = firstSelected.model.trim();
        const provider = firstSelected.provider.trim();
        if (hasExactModelProvider(model, provider)) {
            return { model, provider };
        }
    }

    const selectedModel = options.selectedModel.trim();
    const selectedProvider = options.selectedProvider.trim();
    if (hasExactModelProvider(selectedModel, selectedProvider)) {
        return { model: selectedModel, provider: selectedProvider };
    }

    const persistedModel = options.appSettings?.general.defaultModel?.trim() ?? '';
    const persistedProvider = options.appSettings?.general.lastProvider?.trim() ?? '';
    if (hasExactModelProvider(persistedModel, persistedProvider)) {
        return { model: persistedModel, provider: persistedProvider };
    }

    if (availableModels.length > 0) {
        const firstAvailable = availableModels.find(model => model.id && getSelectableProviderId(model) !== '');
        if (firstAvailable?.id) {
            return { model: firstAvailable.id, provider: getSelectableProviderId(firstAvailable) };
        }
    }

    return { model: selectedModel, provider: selectedProvider };
}

function resolveSystemModeFromSettings(appSettings: AppSettings | undefined): 'thinking' | 'agent' | 'fast' {
    const persistedMode = appSettings?.general.chatMode;
    if (persistedMode === 'thinking' || persistedMode === 'agent') {
        return persistedMode;
    }
    return 'fast';
}

function toPersistedChatMode(systemMode: 'thinking' | 'agent' | 'fast'): 'instant' | 'thinking' | 'agent' {
    if (systemMode === 'thinking' || systemMode === 'agent') {
        return systemMode;
    }
    return 'instant';
}

async function persistChatMessageRecord(message: {
    id: string;
    chatId: string;
    role: string;
    content: string | Message['content'];
    timestamp: number;
    provider?: string;
    model?: string;
    images?: string[];
    metadata?: Message['metadata'];
}): Promise<void> {
    const attemptPersist = async () => {
        const result = await window.electron.db.addMessage(message as unknown as Message & { chatId: string });
        if (!result?.success) {
            throw new Error('Failed to persist chat message');
        }
    };

    try {
        await attemptPersist();
    } catch {
        await new Promise(resolve => setTimeout(resolve, 80));
        await attemptPersist();
    }
}

function useChatInitialization(loadFolders: () => Promise<void>): void {
    useEffect(() => {
        const load = async () => {
            try {
                const allChats = await CachedDatabase.getAllChats();
                const visibleChats = (allChats as Chat[]).filter(
                    chat => !isWorkspaceAgentChat(chat)
                );
                const hydratedChats = trimChats(
                    visibleChats.map(chat => ({
                        ...chat,
                        messages: []
                    }))
                );
                setChats(previousChats => {
                    if (previousChats.length === 0) {
                        return hydratedChats;
                    }

                    const mergedById = new Map<string, Chat>();
                    for (const chat of hydratedChats) {
                        mergedById.set(chat.id, chat);
                    }
                    for (const chat of previousChats) {
                        const existing = mergedById.get(chat.id);
                        if (!existing) {
                            continue;
                        }
                        mergedById.set(chat.id, {
                            ...existing,
                            messages: chat.messages.length > 0 ? chat.messages : existing.messages,
                            isGenerating: chat.isGenerating ?? existing.isGenerating,
                        });
                    }

                    return trimChats(Array.from(mergedById.values()));
                });
                await loadFolders();
            } catch (error) {
                appLogger.error('ChatManager', 'Failed to initialize chats', error as Error);
            }
        };
        void load();

        const removeStatusListener = window.electron.session.conversation.onGenerationStatus((data: SessionConversationGenerationStatus) => {
            if (data.chatId) {
                updateChatInStore(data.chatId, { isGenerating: data.isGenerating });
            }
        });
        return () => { removeStatusListener(); };
    }, [loadFolders]);
}

function useLazyMessageLoader(currentChatId: string | null, chats: Chat[]): void {
    const loadedChatIdsRef = useRef(new Set<string>());

    useEffect(() => {
        if (!currentChatId || loadedChatIdsRef.current.has(currentChatId)) { return; }
        const targetChat = chats.find(c => c.id === currentChatId);
        if (!targetChat) { return; }

        const fetchMessages = async () => {
            try {
                let messages = await window.electron.db.getMessages(currentChatId);
                if (messages.length === 0 && (targetChat.messages?.length ?? 0) === 0) {
                    await new Promise(resolve => setTimeout(resolve, 120));
                    messages = await window.electron.db.getMessages(currentChatId);
                }
                const trimmedMessages = trimMessages(messages as Message[]);
                setChats(previousChats => previousChats.map(c => {
                    if (c.id !== currentChatId) {return c;}
                    return { ...c, messages: deduplicateMessages([...c.messages, ...trimmedMessages]) };
                }));

                const currentChat = getChatSnapshot().chats.find(c => c.id === currentChatId);
                if (trimmedMessages.length > 0 || (currentChat?.messages.length ?? 0) > 0) {
                    loadedChatIdsRef.current.add(currentChatId);
                }
            } catch (e) {
                appLogger.error('ChatManager', `Failed to load messages for ${currentChatId}`, e as Error);
            }
        };
        void fetchMessages();
    }, [currentChatId, chats]);
}

export function useChatManager(options: UseChatManagerOptions) {
    const { 
        selectedModel, 
        selectedProvider, 
        language, 
        appSettings, 
        autoReadEnabled, 
        handleSpeak, 
        formatChatError, 
        t,
        activeWorkspacePath,
        workspaceId,
        models,
    } = options;

    const chats = useChatStore(s => s.chats);
    const currentChatId = useChatStore(s => s.currentChatId);
    
    const [searchTerm, setSearchTerm] = useState('');
    const [input, setInput] = useState('');
    const isSendingRef = useRef(false);

    const systemMode = resolveSystemModeFromSettings(appSettings);
    const [imageRequestCount, setImageRequestCount] = useState(1);
    const permissionPolicyInitial = {
        commandPolicy: 'ask-every-time',
        pathPolicy: 'workspace-root-only',
        allowedCommands: [],
        disallowedCommands: [],
        allowedPaths: []
    } satisfies WorkspaceAgentPermissionPolicy;
    const [permissionPolicy, setPermissionPolicy] = useState<WorkspaceAgentPermissionPolicy>(permissionPolicyInitial);
    const prevChatIdRef = useRef<string | null>(null);

    useEffect(() => {
        if (!appSettings) {return;}
        const newPolicy = {
            commandPolicy: appSettings.general.agentCommandPolicy ?? 'ask-every-time',
            pathPolicy: appSettings.general.agentPathPolicy ?? 'workspace-root-only',
            allowedCommands: appSettings.general.agentAllowedCommands ?? [],
            disallowedCommands: appSettings.general.agentDisallowedCommands ?? [],
            allowedPaths: appSettings.general.agentAllowedPaths ?? []
        };
        const rafId = requestAnimationFrame(() => {
            setPermissionPolicy(prev => {
                if (JSON.stringify(prev) === JSON.stringify(newPolicy)) {return prev;}
                return newPolicy;
            });
        });
        return () => cancelAnimationFrame(rafId);
    }, [appSettings]);

    const setSystemMode = useCallback((nextMode: 'thinking' | 'agent' | 'fast') => {
        const currentSettings = getSettingsSnapshot().settings ?? appSettings;
        if (!currentSettings) {
            return;
        }

        const persistedMode = toPersistedChatMode(nextMode);
        if (currentSettings.general.chatMode === persistedMode) {
            return;
        }

        void updateSettings({
            ...currentSettings,
            general: {
                ...currentSettings.general,
                chatMode: persistedMode,
            }
        });
    }, [appSettings]);

    const { prompts, createPrompt, deletePrompt, updatePrompt } = usePromptManager();
    const {
        streamingStates,
        lastChatError,
        clearChatError,
        generateResponse,
        stopGeneration,
        antigravityCreditConfirmation,
        confirmAntigravityCreditUsage,
        cancelAntigravityCreditUsage,
    } = useChatGenerator({
        chats, 
        appSettings, 
        selectedModel, 
        selectedProvider, 
        selectedModels: options.selectedModels,
        language, 
        activeWorkspacePath, 
        workspaceId, 
        quotas: options.quotas, 
        linkedAccounts: options.linkedAccounts,
        t, 
        handleSpeak, 
        autoReadEnabled, 
        formatChatError, 
        systemMode
    });

    const { folders, loadFolders, createFolder, updateFolder, deleteFolder: baseDeleteFolder } = useFolderManager();
    const { isListening, startListening, stopListening } = useSpeechRecognition(language, (text) => { setInput(prev => (prev.trim() ? `${prev} ${text} ` : text)); });
    
    const { 
        createNewChat, deleteChat, clearMessages, deleteFolder, moveChatToFolder, 
        addMessage, updateChat, togglePin, toggleFavorite, bulkDeleteChats 
    } = useChatCRUD({ 
        currentChatId, 
        setCurrentChatId, 
        setChats, 
        setInput, 
        baseDeleteFolder 
    });

    const { attachments, setAttachments, processFile, removeAttachment } = useAttachments();

    useEffect(() => {
        if (!currentChatId) {return;}
        const chat = chats.find(c => c.id === currentChatId);
        if (!chat) {return;}

        const existingPolicy = readChatPermissionPolicy(chat);
        if (JSON.stringify(existingPolicy) !== JSON.stringify(permissionPolicy)) {
            const existingMetadataEntry = chat.metadata?.[WORKSPACE_AGENT_METADATA_KEY] && !Array.isArray(chat.metadata[WORKSPACE_AGENT_METADATA_KEY]) && typeof chat.metadata[WORKSPACE_AGENT_METADATA_KEY] === 'object'
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
    }, [permissionPolicy, chats, currentChatId, updateChat]);

    useEffect(() => {
        if (!currentChatId || prevChatIdRef.current === currentChatId) {
            if (!currentChatId) {prevChatIdRef.current = null;}
            return;
        }
        prevChatIdRef.current = currentChatId;

        const chat = chats.find(c => c.id === currentChatId);
        const policy = chat ? readChatPermissionPolicy(chat) : null;
        if (policy) {
            const rafId = requestAnimationFrame(() => {
                setPermissionPolicy(prev => {
                    if (JSON.stringify(prev) === JSON.stringify(policy)) {return prev;}
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

    useChatInitialization(loadFolders);
    useLazyMessageLoader(currentChatId, chats);

    useEffect(() => {
        if (prevChatIdRef.current !== null && prevChatIdRef.current !== currentChatId) {
            const snapshot = getChatSnapshot().chats;
            const updated = snapshot.map(c =>
                c.id === prevChatIdRef.current && c.messages.length > MAX_MESSAGES_IN_MEMORY
                    ? { ...c, messages: trimMessages(c.messages) }
                    : c
            );
            setChats(updated);
        }
        prevChatIdRef.current = currentChatId;
    }, [currentChatId]);

    const contextTokens = useMemo(() => {
        const chat = chats.find(c => c.id === currentChatId);
        if (!chat) {
            return 0;
        }

        return chat.messages.reduce((acc, msg) => {
            if (msg.usage?.totalTokens) {return acc + msg.usage.totalTokens;}
            const contentLen = typeof msg.content === 'string' ? msg.content.length : 0;
            return acc + Math.ceil(contentLen / 4);
        }, 0);
    }, [chats, currentChatId]);

    const contextWindow = useMemo(() => {
        const isOllamaProvider = selectedProvider.toLowerCase() === 'ollama' || selectedModel.toLowerCase().startsWith('ollama/');
        if (isOllamaProvider) {
            const configured = getConfiguredOllamaContextWindow(appSettings, selectedModel);
            if (configured !== null) {
                return configured;
            }
        }

        const activeModelInfo = models.find(m => m.id === selectedModel);
        if (activeModelInfo?.contextWindow !== undefined) {
            return Number(activeModelInfo.contextWindow);
        }
        return 128000;
    }, [appSettings, models, selectedModel, selectedProvider]);

    const currentChat = useMemo(() => chats.find(c => c.id === currentChatId), [chats, currentChatId]);
    const currentSessionState = useSessionState(currentChatId);
    const currentStreamState = currentChatId ? streamingStates[currentChatId] : undefined;
    const streamingReasoning = useMemo(() => currentStreamState?.reasoning ?? '', [currentStreamState]);
    const streamingSpeed = useMemo(() => currentStreamState?.speed ?? null, [currentStreamState]);
    const chatError = useMemo(() => {
        if (!currentChatId) {return lastChatError;}
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
            index.set(message.id, (typeof message.content === 'string' ? message.content : '').toLowerCase());
        }
        return index;
    }, [messages]);

    const displayMessages = useMemo(
        () => normalizedSearchTerm === '' ? messages : messages.filter(message => (messageSearchIndex.get(message.id) ?? '').includes(normalizedSearchTerm)),
        [messages, messageSearchIndex, normalizedSearchTerm]
    );

    const handleSend = useCallback(async (customInput?: string) => {
        const content = customInput ?? input;
        const readyAttachments = attachments.filter(att => att.status === 'ready');
        const hasInputText = content.trim() !== '';
        const hasReadyAttachments = readyAttachments.length > 0;
        const activeSelection = resolveActiveModelSelection({
            selectedModel,
            selectedProvider,
            selectedModels: options.selectedModels,
            appSettings,
            models,
        });
        
        if (isSendingRef.current) {return;}
        if ((!hasInputText && !hasReadyAttachments) || !activeSelection.model || !activeSelection.provider || isLoading) {return;}

        isSendingRef.current = true;
        try {
            setInput('');
            const timestamp = Date.now();
            const imageInputs = readyAttachments.flatMap(att => {
                if (att.type === 'image' && typeof att.content === 'string' && att.content.startsWith('data:image/')) {return [att.content];}
                if (att.type === 'video' && typeof att.preview === 'string' && att.preview.startsWith('data:image/')) {return [att.preview];}
                return [];
            });
            const attachmentContext = buildAttachmentPromptContext(readyAttachments, t('frontend.chat.attachmentPrompt.label'));
            const mergedContent = hasInputText ? `${content}${attachmentContext}` : `${attachmentContext}\n[${t('frontend.chat.attachmentPrompt.analyzeMedia')}]`.trim();
            
            const userMessage: Message = {
                id: generateId(),
                role: 'user',
                content: mergedContent,
                timestamp: new Date(timestamp),
                images: imageInputs.length > 0 ? imageInputs : undefined,
                metadata: isImageOnlyModel(activeSelection.model) ? { imageRequestCount } : undefined
            };

            let chatId = currentChatId;
            let createdNewChat = false;

            if (!chatId) {
                const newChatId = generateId();
                const createdAtMs = Date.now();
                const chatTitle = mergedContent.slice(0, 50);
                const newChatDb = {
                    id: newChatId,
                    title: chatTitle,
                    model: activeSelection.model,
                    backend: activeSelection.provider,
                    createdAt: createdAtMs,
                    updatedAt: createdAtMs,
                    isGenerating: true
                };

                const newChat: Chat = {
                    ...newChatDb,
                    messages: [userMessage],
                    createdAt: new Date(createdAtMs),
                    updatedAt: new Date(createdAtMs),
                    isGenerating: true
                };

                setChats(previousChats => [newChat, ...previousChats]);
                setCurrentChatId(newChatId);
                chatId = newChatId;
                createdNewChat = true;

                const createResult = await window.electron.db.createChat(newChatDb);
                if (!createResult.success) {
                    setChats(previousChats => previousChats.filter(chat => chat.id !== newChatId));
                    setCurrentChatId(null);
                    return;
                }
            } else {
                updateChatInStore(chatId, { isGenerating: true });
                void window.electron.db.updateChat?.(chatId, { isGenerating: true }).catch((error) => {
                    appLogger.warn('ChatManager', `Failed to persist generation start for ${chatId}`, error as Error);
                });
            }

            const targetChat = getChatSnapshot().chats.find(c => c.id === chatId);
            if (targetChat && !createdNewChat) {
                updateChatInStore(chatId, {
                    messages: deduplicateMessages([...targetChat.messages, userMessage]),
                    title: targetChat.messages.length === 0 ? mergedContent.slice(0, 50) : targetChat.title
                });
            }

            await persistChatMessageRecord({
                ...userMessage,
                chatId,
                timestamp,
                provider: activeSelection.provider,
                model: activeSelection.model
            });
            setAttachments([]);
            void generateResponse(chatId, userMessage, undefined, {
                provider: activeSelection.provider,
                model: activeSelection.model,
                selectedModels: options.selectedModels && options.selectedModels.length > 1
                    ? options.selectedModels
                    : [{ provider: activeSelection.provider, model: activeSelection.model }],
            });
        } finally {
            isSendingRef.current = false;
        }
    }, [input, attachments, selectedModel, selectedProvider, options.selectedModels, appSettings, isLoading, currentChatId, generateResponse, imageRequestCount, t, setAttachments, models]);

    const regenerateMessage = useCallback(
        async (assistantMessageId: string) => {
            if (!currentChatId || isLoading) {return;}
            const chat = chats.find(c => c.id === currentChatId);
            if (!chat) {return;}

            const assistantIndex = chat.messages.findIndex(m => m.id === assistantMessageId && m.role === 'assistant');
            if (assistantIndex <= 0) {return;}

            const previousUserMessage = [...chat.messages.slice(0, assistantIndex)].reverse().find(m => m.role === 'user');
            const prompt = previousUserMessage ? toTextContent(previousUserMessage.content) : '';
            if (!prompt) {return;}

            await handleSend(prompt);
        },
        [currentChatId, isLoading, chats, handleSend]
    );

    return useMemo(() => ({
        chats, setChats, currentChatId, setCurrentChatId, messages, displayMessages, searchTerm, setSearchTerm, input, setInput, isLoading,
        streamingReasoning, streamingSpeed, chatError, clearChatError, contextTokens, contextWindow, handleSend, stopGeneration, createNewChat, deleteChat, clearMessages,
        folders, createFolder, updateFolder, deleteFolder, moveChatToFolder, addMessage, prompts, createPrompt, deletePrompt, updatePrompt,
        isListening, startListening, stopListening, updateChat, togglePin, toggleFavorite, attachments, setAttachments, processFile, removeAttachment,
        t, handleSpeak, systemMode, setSystemMode, imageRequestCount, setImageRequestCount, regenerateMessage, bulkDeleteChats,
        permissionPolicy, setPermissionPolicy, antigravityCreditConfirmation, confirmAntigravityCreditUsage, cancelAntigravityCreditUsage
    }), [chats, currentChatId, messages, displayMessages, searchTerm, input, isLoading, streamingReasoning, streamingSpeed, chatError, clearChatError, contextTokens, contextWindow,
        handleSend, stopGeneration, createNewChat, deleteChat, clearMessages, folders, createFolder, updateFolder, deleteFolder, moveChatToFolder,
        addMessage, prompts, createPrompt, deletePrompt, updatePrompt, isListening, startListening, stopListening, updateChat, togglePin, toggleFavorite,
        attachments, setAttachments, processFile, removeAttachment, t, handleSpeak, systemMode, setSystemMode, imageRequestCount, regenerateMessage, bulkDeleteChats,
        permissionPolicy, setPermissionPolicy, antigravityCreditConfirmation, confirmAntigravityCreditUsage, cancelAntigravityCreditUsage]);
}

