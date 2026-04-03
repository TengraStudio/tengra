import { SettingsService } from '@main/services/system/settings.service';
import { Message, SystemMode, ToolCall, ToolResult } from '@shared/types/chat';
import { JsonObject } from '@shared/types/common';
import { SessionConversationCompleteResult } from '@shared/types/session-conversation';
import {
    buildAiPresentationMetadata,
    classifyAiIntent,
} from '@shared/utils/ai-runtime.util';

interface ConversationAssistantMetadataParams {
    messages: Message[];
    settingsService: SettingsService;
    systemMode?: SystemMode;
    content: string;
    reasoning?: string;
    toolCalls?: ToolCall[];
    toolResults?: ToolResult[];
    sources?: string[];
    images?: string[];
    isStreaming?: boolean;
    language?: string;
    evidenceSnapshot?: import('@shared/types/ai-runtime').AiEvidenceStoreSnapshot;
}

interface ConversationAssistantRecordParams extends ConversationAssistantMetadataParams {
    chatId: string;
    model: string;
    provider: string;
    timestamp?: number;
}

interface ConversationCompleteResultParams extends ConversationAssistantMetadataParams {
    role: 'assistant';
}

export function getConversationLanguage(settingsService: SettingsService): string {
    const settings = settingsService.getSettings();
    const configuredLanguage = settings.general?.language;
    return typeof configuredLanguage === 'string' && configuredLanguage.trim().length > 0
        ? configuredLanguage
        : 'en';
}

function getIntentSeedMessage(messages: Message[]): Message {
    const userMessage = [...messages].reverse().find(message => message.role === 'user');
    if (userMessage) {
        return userMessage;
    }

    return {
        id: 'session-runtime-intent-seed',
        role: 'user',
        content: '',
        timestamp: new Date(),
    };
}

export function buildConversationAssistantMetadata(
    params: ConversationAssistantMetadataParams
): JsonObject {
    const {
        messages,
        settingsService,
        systemMode,
        content,
        reasoning,
        toolCalls,
        toolResults,
        sources,
        images,
        isStreaming,
        language: paramLanguage,
        evidenceSnapshot,
    } = params;
    const language = paramLanguage ?? getConversationLanguage(settingsService);
    const intentClassification = classifyAiIntent(
        getIntentSeedMessage(messages),
        systemMode ?? 'thinking'
    );

    return {
        aiPresentation: buildAiPresentationMetadata({
            intent: intentClassification,
            content,
            reasoning,
            toolCalls,
            toolResults,
            sources,
            images,
            isStreaming,
            language,
            evidenceSnapshot,
        }),
    };
}

export function createConversationAssistantRecord(
    params: ConversationAssistantRecordParams
): JsonObject {
    const {
        chatId,
        model,
        provider,
        content,
        reasoning,
        toolCalls,
        sources,
        images,
        timestamp,
    } = params;

    return {
        chatId,
        role: 'assistant',
        content,
        reasoning,
        provider,
        model,
        timestamp: timestamp ?? Date.now(),
        ...(toolCalls && toolCalls.length > 0 ? { toolCalls } : {}),
        ...(sources && sources.length > 0 ? { sources } : {}),
        ...(images && images.length > 0 ? { images } : {}),
        metadata: buildConversationAssistantMetadata(params),
    };
}

export function createConversationCompleteResult(
    params: ConversationCompleteResultParams
): SessionConversationCompleteResult {
    const {
        content,
        reasoning,
        toolCalls,
        sources,
        images,
    } = params;

    return {
        content,
        role: 'assistant',
        ...(toolCalls && toolCalls.length > 0 ? { toolCalls } : {}),
        ...(reasoning ? { reasoning } : {}),
        ...(images && images.length > 0 ? { images } : {}),
        ...(sources && sources.length > 0 ? { sources } : {}),
        metadata: buildConversationAssistantMetadata(params),
    };
}
