import { useCallback, useMemo, useState } from 'react';
import { z } from 'zod';

import { useAuth } from '@/context/AuthContext';
import { useChat } from '@/context/ChatContext';
import { useModel } from '@/context/ModelContext';
import { useTranslation } from '@/i18n';
import { recordChatHealthEvent } from '@/store/chat-health.store';
import { Prompt } from '@/types';
import { appLogger } from '@/utils/renderer-logger';

const CHAT_INPUT_MAX_LENGTH = 12000;
const IMAGE_ONLY_MODEL_PATTERNS = [
    'gemini-3.1-flash-image',
    'gemini-3.1-flash-image-preview',
    'gemini-3-pro-image',
    'gemini-3-pro-image-preview',
    'gemini-2.5-flash-image',
    'gemini-2.5-flash-image-preview',
    'imagen-3.0-generate-001'
] as const;
const CHAT_INPUT_SCHEMA = z.string().max(CHAT_INPUT_MAX_LENGTH);
const CHAT_INPUT_ERROR = {
    INPUT_VALIDATION: {
        code: 'CHAT_INPUT_VALIDATION_ERROR',
        messageKey: 'errors.unexpected'
    },
    SEND_BLOCKED: {
        code: 'CHAT_SEND_BLOCKED',
        messageKey: 'errors.unexpected'
    },
    SEND_FAILED: {
        code: 'CHAT_SEND_FAILED',
        messageKey: 'errors.unexpected'
    },
    ENHANCE_FAILED: {
        code: 'CHAT_ENHANCE_FAILED',
        messageKey: 'errors.unexpected'
    }
} as const;

type ChatInputErrorState = {
    code: string;
    messageKey: string;
    uiState: 'failure';
} | null;

function usePromptCommands(prompts: Prompt[], input: string, setInput: (v: string) => void) {
    const [showCommandMenu, setShowCommandMenu] = useState(false);
    const [commandQuery, setCommandQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);

    const filteredPrompts = useMemo(() => {
        if (commandQuery === '') { return prompts.slice(0, 5); }
        const query = commandQuery.toLowerCase();
        return prompts.filter(p =>
            p.title.toLowerCase().includes(query) ||
            p.tags.some(tag => tag.toLowerCase().includes(query))
        ).slice(0, 5);
    }, [prompts, commandQuery]);

    const handleCommandNavigation = useCallback((e: React.KeyboardEvent) => {
        const len = filteredPrompts.length;
        const mod = Math.max(1, len);
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev + 1) % mod);
            return true;
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev - 1 + mod) % mod);
            return true;
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
            const selected = filteredPrompts[selectedIndex] as Prompt | undefined;
            if (selected !== undefined) {
                e.preventDefault();
                const words = input.split(' ');
                words.pop();
                const newText = words.join(' ') + (words.length > 0 ? ' ' : '') + selected.content;
                setInput(newText);
                setShowCommandMenu(false);
                return true;
            }
        }
        if (e.key === 'Escape') {
            setShowCommandMenu(false);
            return true;
        }
        return false;
    }, [filteredPrompts, input, selectedIndex, setInput]);

    return {
        showCommandMenu, setShowCommandMenu,
        commandQuery, setCommandQuery,
        selectedIndex, setSelectedIndex,
        filteredPrompts, handleCommandNavigation
    };
}

export function useChatInputController() {
    const {
        input, setInput, attachments, removeAttachment, processFile,
        isLoading, handleSend: sendMessage, stopGeneration,
        prompts, isListening, startListening, stopListening,
        contextTokens,
        imageRequestCount, setImageRequestCount,
        systemMode, setSystemMode
    } = useChat();

    const {
        selectedModel, selectedProvider, selectedModels,
        handleSelectModel, removeSelectedModel, groupedModels,
        setIsModelMenuOpen, toggleFavorite, isFavorite,
        getModelReasoningLevel, setModelReasoningLevel
    } = useModel();

    const { appSettings, quotas, copilotQuota, codexUsage, claudeQuota, language } = useAuth();
    const { t } = useTranslation(language);

    const [isDragging, setIsDragging] = useState(false);
    const [isEnhancing, setIsEnhancing] = useState(false);
    const [lastError, setLastError] = useState<ChatInputErrorState>(null);

    const isImageOnlyModel = useMemo(() => {
        const normalizedModel = selectedModel.trim().toLowerCase();
        return IMAGE_ONLY_MODEL_PATTERNS.some(pattern => normalizedModel.includes(pattern));
    }, [selectedModel]);

    const clearLastError = useCallback(() => {
        setLastError(null);
    }, []);

    const updateInput = useCallback((nextValue: string) => {
        const normalized = nextValue.replace(/\r\n/g, '\n');
        const parsed = CHAT_INPUT_SCHEMA.safeParse(normalized);
        if (!parsed.success) {
            setInput(normalized.slice(0, CHAT_INPUT_MAX_LENGTH));
            setLastError({
                code: CHAT_INPUT_ERROR.INPUT_VALIDATION.code,
                messageKey: CHAT_INPUT_ERROR.INPUT_VALIDATION.messageKey,
                uiState: 'failure'
            });
            recordChatHealthEvent({
                channel: 'chat.input',
                status: 'validation-failure',
                errorCode: CHAT_INPUT_ERROR.INPUT_VALIDATION.code
            });
            return;
        }

        setInput(parsed.data);
        setLastError(null);
    }, [setInput]);

    const cmd = usePromptCommands(prompts, input, updateInput);

    const getOllamaEnhanceModel = useCallback(async () => {
        const running = await window.electron.isOllamaRunning();
        if (!running) { return null; }
        const models = groupedModels?.ollama.models ?? [];
        if (models.length === 0) { return null; }
        const preferred = ['llama3.2:1b', 'llama3.2:3b', 'qwen2.5:0.5b', 'qwen2.5:1.5b', 'gemma2:2b', 'phi3:mini'];
        const found = models.find(m => {
            const mid = m.id;
            return mid && preferred.some(pm => mid.toLowerCase().includes(pm.toLowerCase()));
        });
        return { model: found?.id ?? models[0].id ?? '', provider: 'ollama' };
    }, [groupedModels]);

    const getFallbackModel = useCallback(() => {
        const cpModels = groupedModels?.copilot.models ?? [];
        if (cpModels.length > 0) { return { model: cpModels[0].id ?? 'gpt-4o-mini', provider: 'copilot' }; }
        const agModels = groupedModels?.antigravity.models ?? [];
        if (agModels.length > 0) { return { model: agModels[0].id ?? '', provider: 'antigravity' }; }
        return { model: selectedModel, provider: selectedProvider };
    }, [groupedModels, selectedModel, selectedProvider]);

    const getProxyEnhanceModel = useCallback(() => {
        const agModels = groupedModels?.antigravity.models ?? [];
        const pref = ['claude-3-haiku', 'gpt-4o-mini', 'claude-3-5-haiku'];
        const found = agModels.find(m => m.id !== undefined && pref.some(p => m.id?.toLowerCase().includes(p.toLowerCase())));
        if (found) { return { model: found.id ?? '', provider: 'antigravity' }; }
        return getFallbackModel();
    }, [groupedModels, getFallbackModel]);

    const callEnhanceLlm = useCallback(async (m: string, p: string) => {
        const res = await window.electron.session.conversation.complete({
            messages: [
                {
                    id: '1',
                    role: 'system',
                    content: t('input.enhancePromptSystem'),
                    timestamp: new Date()
                },
                { id: '2', role: 'user', content: input, timestamp: new Date() }
            ],
            model: m, tools: [], provider: p
        });
        if (res?.content) {
            let text = res.content.trim();
            if (text.startsWith('"') && text.endsWith('"')) { text = text.slice(1, -1); }
            else if (text.startsWith("'") && text.endsWith("'")) { text = text.slice(1, -1); }
            updateInput(text);
            setLastError(null);
            return true;
        }
        return false;
    }, [input, updateInput, t]);

    const getEnhanceModel = useCallback(async () => {
        const ollama = await getOllamaEnhanceModel();
        if (ollama) { return ollama; }
        return getProxyEnhanceModel();
    }, [getOllamaEnhanceModel, getProxyEnhanceModel]);

    const handleEnhancePrompt = useCallback(async () => {
        if (input.trim() === '' || isEnhancing || isLoading) { return; }
        setIsEnhancing(true);
        const startedAt = Date.now();
        try {
            const { model, provider } = await getEnhanceModel();
            if (!model) {
                throw new Error(CHAT_INPUT_ERROR.ENHANCE_FAILED.code);
            }
            let enhanced = false;
            for (let attempt = 0; attempt < 2; attempt += 1) {
                try {
                    enhanced = await callEnhanceLlm(model, provider);
                    if (enhanced) { break; }
                } catch (error) {
                    if (attempt === 0) {
                        await new Promise(resolve => setTimeout(resolve, 50));
                        continue;
                    }
                    throw error;
                }
            }
            if (!enhanced) {
                throw new Error(CHAT_INPUT_ERROR.ENHANCE_FAILED.code);
            }
            setLastError(null);
            recordChatHealthEvent({
                channel: 'chat.enhance',
                status: 'success',
                durationMs: Date.now() - startedAt
            });
        } catch (error) {
            appLogger.error('ChatInput', 'Failed to enhance prompt', error as Error);
            setLastError({
                code: CHAT_INPUT_ERROR.ENHANCE_FAILED.code,
                messageKey: CHAT_INPUT_ERROR.ENHANCE_FAILED.messageKey,
                uiState: 'failure'
            });
            recordChatHealthEvent({
                channel: 'chat.enhance',
                status: 'failure',
                durationMs: Date.now() - startedAt,
                errorCode: CHAT_INPUT_ERROR.ENHANCE_FAILED.code
            });
        } finally {
            setIsEnhancing(false);
        }
    }, [input, isEnhancing, isLoading, getEnhanceModel, callEnhanceLlm]);

    const sendMessageWithTelemetry = useCallback(async () => {
        const hasContent = input.trim() !== '' || attachments.length > 0;
        if (!hasContent || isLoading) {
            setLastError({
                code: CHAT_INPUT_ERROR.SEND_BLOCKED.code,
                messageKey: CHAT_INPUT_ERROR.SEND_BLOCKED.messageKey,
                uiState: 'failure'
            });
            recordChatHealthEvent({
                channel: 'chat.send',
                status: 'validation-failure',
                errorCode: CHAT_INPUT_ERROR.SEND_BLOCKED.code
            });
            return;
        }

        const startedAt = Date.now();
        try {
            await sendMessage();
            setLastError(null);
            recordChatHealthEvent({
                channel: 'chat.send',
                status: 'success',
                durationMs: Date.now() - startedAt
            });
        } catch (error) {
            appLogger.error('ChatInput', 'Failed to send message', error as Error);
            setLastError({
                code: CHAT_INPUT_ERROR.SEND_FAILED.code,
                messageKey: CHAT_INPUT_ERROR.SEND_FAILED.messageKey,
                uiState: 'failure'
            });
            recordChatHealthEvent({
                channel: 'chat.send',
                status: 'failure',
                durationMs: Date.now() - startedAt,
                errorCode: CHAT_INPUT_ERROR.SEND_FAILED.code
            });
        }
    }, [attachments.length, input, isLoading, sendMessage]);

    const onDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault(); e.stopPropagation();
        setIsDragging(false);
        const files = e.dataTransfer.files;
        if (files.length > 0) { void processFile(files[0]); }
    }, [processFile]);

    return {
        input, setInput: updateInput, attachments, removeAttachment, processFile,
        isLoading, sendMessage, sendMessageWithTelemetry, stopGeneration, isListening, startListening, stopListening,
        contextTokens, selectedModel, selectedProvider, selectedModels,
        handleSelectModel, removeSelectedModel, groupedModels, setIsModelMenuOpen,
        toggleFavorite, isFavorite, appSettings, quotas, copilotQuota, codexUsage, claudeQuota,
        language, t, isDragging, setIsDragging, isEnhancing, handleEnhancePrompt, onDrop,
        lastError, clearLastError,
        systemMode, setSystemMode,
        chatInputMaxLength: CHAT_INPUT_MAX_LENGTH,
        isImageOnlyModel,
        imageRequestCount,
        setImageRequestCount,
        getModelReasoningLevel, setModelReasoningLevel,
        ...cmd
    };
}
