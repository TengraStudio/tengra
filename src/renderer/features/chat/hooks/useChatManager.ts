import { useAttachments } from '@renderer/features/chat/hooks/useAttachments';
import { useChatCRUD } from '@renderer/features/chat/hooks/useChatCRUD';
import { useChatGenerator } from '@renderer/features/chat/hooks/useChatGenerator';
import { useFolderManager } from '@renderer/features/chat/hooks/useFolderManager';
import { usePromptManager } from '@renderer/features/chat/hooks/usePromptManager';
import { useSpeechRecognition } from '@renderer/features/chat/hooks/useSpeechRecognition';
import { useSessionState } from '@renderer/hooks/useSessionState';
import type { SessionConversationGenerationStatus } from '@shared/types/session-conversation';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';

import { generateId } from '@/lib/utils';
import { AppSettings, Chat, Message } from '@/types';
import { CatchError } from '@/types/common'; // Force update

/** Maximum messages to keep in memory per chat to prevent memory leaks */
const MAX_MESSAGES_IN_MEMORY = 100;

/** Maximum chats to keep in memory */
const MAX_CHATS_IN_MEMORY = 50;

interface SelectedModelInfo { provider: string; model: string }

interface UseChatManagerOptions {
    selectedModel: string
    selectedProvider: string
    selectedModels?: SelectedModelInfo[]
    language: string
    selectedPersona?: { id: string, name: string, description: string, prompt: string } | null | undefined
    appSettings?: AppSettings | undefined
    autoReadEnabled: boolean
    handleSpeak: (id: string, text: string) => void
    formatChatError: (err: CatchError) => string
    t: (key: string) => string
    activeWorkspacePath?: string | undefined
    workspaceId?: string | undefined
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

function buildAttachmentPromptContext(attachments: ReturnType<typeof useAttachments>['attachments']): string {
    const nonImageAttachments = attachments.filter(att => att.type !== 'image');
    if (nonImageAttachments.length === 0) {
        return '';
    }
    return nonImageAttachments
        .map(att => {
            const summary = (att.content ?? '').trim();
            const safeSummary = summary.length > 5000 ? `${summary.slice(0, 5000)}...` : summary;
            return `\n[Attachment: ${att.name}]\n${safeSummary}`;
        })
        .join('\n');
}

function useChatInitialization(loadFolders: () => Promise<void>, setChats: React.Dispatch<React.SetStateAction<Chat[]>>): void {
    useEffect(() => {
        const load = async () => {
            const allChats = await window.electron.db.getAllChats();
            // Load chat metadata first; message bodies are loaded lazily per chat selection.
            const trimmedChats = trimChats((allChats as Chat[]).map(chat => ({
                ...chat,
                messages: []
            })));
            setChats(trimmedChats);
            await loadFolders();
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
                // Trim messages to prevent memory bloat
                const trimmedMessages = trimMessages(messages as Message[]);
                setChats(prev => prev.map(c => c.id === currentChatId ? { ...c, messages: trimmedMessages } : c));
            } catch (e) {
                window.electron.log.error(`Failed to load messages for ${currentChatId}`, e as Error);
            }
        };
        void fetchMessages();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentChatId]);
}

export function useChatManager(options: UseChatManagerOptions) {
    const { selectedModel, selectedProvider, language, selectedPersona, appSettings, autoReadEnabled, handleSpeak, formatChatError, t } = options;

    const [chats, setChats] = useState<Chat[]>([]);
    const [currentChatId, setCurrentChatId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [input, setInput] = useState('');
    const [contextTokens] = useState(0);
    const [systemMode, setSystemMode] = useState<'thinking' | 'agent' | 'fast'>('agent');

    // Track previous chat ID for cleanup
    const prevChatIdRef = useRef<string | null>(null);

    const { prompts, createPrompt, deletePrompt, updatePrompt } = usePromptManager();
    const { streamingStates, lastChatError, clearChatError, generateResponse, stopGeneration } = useChatGenerator({
        chats, setChats, appSettings, selectedModel, selectedProvider, selectedModels: options.selectedModels,
        language, selectedPersona, activeWorkspacePath: options.activeWorkspacePath, workspaceId: options.workspaceId,
        t, handleSpeak, autoReadEnabled, formatChatError, systemMode
    });
    const { folders, loadFolders, createFolder, updateFolder, deleteFolder: baseDeleteFolder } = useFolderManager();
    const { isListening, startListening, stopListening } = useSpeechRecognition(language, (text) => { setInput(prev => (prev.trim() ? `${prev} ${text} ` : text)); });
    const { createNewChat, deleteChat, clearMessages, deleteFolder, moveChatToFolder, addMessage, updateChat, togglePin, toggleFavorite, bulkDeleteChats } = useChatCRUD({ currentChatId, setCurrentChatId, setChats, setInput, baseDeleteFolder });
    const { attachments, setAttachments, processFile, removeAttachment } = useAttachments();

    useChatInitialization(loadFolders, setChats);
    useLazyMessageLoader(currentChatId, chats, setChats);

    // Cleanup: Trim messages in non-active chats when switching chats
    useEffect(() => {
        if (prevChatIdRef.current !== null && prevChatIdRef.current !== currentChatId) {
            // Switched away from a chat - trim its messages to prevent memory bloat
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
                window.electron.log.error('[useChatManager] Failed to create chat', createResult);
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
        const attachmentContext = buildAttachmentPromptContext(readyAttachments);
        const mergedContent = hasInputText
            ? `${content}${attachmentContext}`
            : `${attachmentContext}\n[Analyze attached media.]`.trim();
        const userMessage: Message = {
            id: generateId(),
            role: 'user',
            content: mergedContent,
            timestamp: new Date(timestamp),
            images: imageInputs.length > 0 ? imageInputs : undefined
        };
        if (!chatId) { throw new Error('Chat ID creation failed'); }
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
    }, [input, attachments, selectedModel, isLoading, currentChatId, selectedProvider, generateResponse, setChats, setAttachments]);

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
        t, handleSpeak, systemMode, setSystemMode, regenerateMessage, bulkDeleteChats
    }), [chats, currentChatId, messages, displayMessages, searchTerm, input, isLoading, streamingReasoning, streamingSpeed, chatError, clearChatError, contextTokens,
        handleSend, stopGeneration, createNewChat, deleteChat, clearMessages, folders, createFolder, updateFolder, deleteFolder, moveChatToFolder,
        addMessage, prompts, createPrompt, deletePrompt, updatePrompt, isListening, startListening, stopListening, updateChat, togglePin, toggleFavorite,
        attachments, setAttachments, processFile, removeAttachment, t, handleSpeak, systemMode, regenerateMessage, bulkDeleteChats]);
}
