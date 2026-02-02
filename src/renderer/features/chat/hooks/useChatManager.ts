import { useAttachments } from '@renderer/features/chat/hooks/useAttachments';
import { useChatCRUD } from '@renderer/features/chat/hooks/useChatCRUD';
import { useChatGenerator } from '@renderer/features/chat/hooks/useChatGenerator';
import { useFolderManager } from '@renderer/features/chat/hooks/useFolderManager';
import { usePromptManager } from '@renderer/features/chat/hooks/usePromptManager';
import { useSpeechRecognition } from '@renderer/features/chat/hooks/useSpeechRecognition';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { generateId } from '@/lib/utils';
import { AppSettings, Chat, Message } from '@/types';
import { CatchError, IpcValue } from '@/types/common';

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
    projectId?: string | undefined
}

function useChatInitialization(loadFolders: () => Promise<void>, setChats: React.Dispatch<React.SetStateAction<Chat[]>>): void {
    useEffect(() => {
        const load = async () => {
            const allChats = await window.electron.db.getAllChats();
            setChats(allChats as Chat[]);
            await loadFolders();
        };
        void load();

        const removeStatusListener = window.electron.on('chat:generation-status', (_event, ...args: IpcValue[]) => {
            const data = (args[0] && typeof args[0] === 'object') ? args[0] as { chatId?: string; isGenerating?: boolean } : {};
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
                setChats(prev => prev.map(c => c.id === currentChatId ? { ...c, messages: messages as Message[] } : c));
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

    const { prompts, createPrompt, deletePrompt, updatePrompt } = usePromptManager();
    const { streamingStates, generateResponse, stopGeneration } = useChatGenerator({
        chats, setChats, appSettings, selectedModel, selectedProvider, selectedModels: options.selectedModels,
        language, selectedPersona, activeWorkspacePath: options.activeWorkspacePath, projectId: options.projectId,
        t, handleSpeak, autoReadEnabled, formatChatError, systemMode
    });
    const { folders, loadFolders, createFolder, updateFolder, deleteFolder: baseDeleteFolder } = useFolderManager();
    const { isListening, startListening, stopListening } = useSpeechRecognition(language, (text) => { setInput(prev => (prev.trim() ? `${prev} ${text} ` : text)); });
    const { createNewChat, deleteChat, clearMessages, deleteFolder, moveChatToFolder, addMessage, updateChat, togglePin, toggleFavorite } = useChatCRUD({ currentChatId, setCurrentChatId, setChats, setInput, baseDeleteFolder });
    const { attachments, setAttachments, processFile, removeAttachment } = useAttachments();

    useChatInitialization(loadFolders, setChats);
    useLazyMessageLoader(currentChatId, chats, setChats);

    const currentChat = chats.find(c => c.id === currentChatId);
    const currentStreamState = currentChatId ? streamingStates[currentChatId] : undefined;
    const streamingReasoning = useMemo(() => currentStreamState?.reasoning ?? '', [currentStreamState]);
    const streamingSpeed = useMemo(() => currentStreamState?.speed ?? null, [currentStreamState]);
    const isLoading = useMemo(() => currentChatId ? Boolean(currentChat?.isGenerating) || Boolean(currentStreamState) : false, [currentChatId, currentChat?.isGenerating, currentStreamState]);
    const messages = useMemo(() => currentChat?.messages ?? [], [currentChat]);
    const displayMessages = useMemo(() => searchTerm ? messages.filter(m => (typeof m.content === 'string' ? m.content : '').toLowerCase().includes(searchTerm.toLowerCase())) : messages, [messages, searchTerm]);

    const handleSend = useCallback(async (customInput?: string) => {
        const content = customInput ?? input;
        if (!content.trim() || !selectedModel || isLoading) { return; }

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
        const userMessage: Message = { id: generateId(), role: 'user', content, timestamp: new Date(timestamp) };
        if (!chatId) { throw new Error('Chat ID creation failed'); }
        await window.electron.db.addMessage({ ...userMessage, chatId, timestamp, provider: selectedProvider, model: selectedModel });
        setChats(prev => prev.map((c: Chat) => c.id === chatId ? { ...c, messages: [...c.messages, userMessage], title: c.messages.length === 0 ? content.slice(0, 50) : c.title } : c));
        void generateResponse(chatId, userMessage);
    }, [input, selectedModel, isLoading, currentChatId, selectedProvider, generateResponse, setChats]);

    return useMemo(() => ({
        chats, setChats, currentChatId, setCurrentChatId, messages, displayMessages, searchTerm, setSearchTerm, input, setInput, isLoading,
        streamingReasoning, streamingSpeed, contextTokens, handleSend, stopGeneration, createNewChat, deleteChat, clearMessages,
        folders, createFolder, updateFolder, deleteFolder, moveChatToFolder, addMessage, prompts, createPrompt, deletePrompt, updatePrompt,
        isListening, startListening, stopListening, updateChat, togglePin, toggleFavorite, attachments, setAttachments, processFile, removeAttachment,
        t, handleSpeak, systemMode, setSystemMode
    }), [chats, currentChatId, messages, displayMessages, searchTerm, input, isLoading, streamingReasoning, streamingSpeed, contextTokens,
        handleSend, stopGeneration, createNewChat, deleteChat, clearMessages, folders, createFolder, updateFolder, deleteFolder, moveChatToFolder,
        addMessage, prompts, createPrompt, deletePrompt, updatePrompt, isListening, startListening, stopListening, updateChat, togglePin, toggleFavorite,
        attachments, setAttachments, processFile, removeAttachment, t, handleSpeak, systemMode]);
}
