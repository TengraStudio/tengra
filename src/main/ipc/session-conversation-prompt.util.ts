import { LocaleService } from '@main/services/system/locale.service';
import { SettingsService } from '@main/services/system/settings.service';
import { buildSystemPrompt, toLocalePromptMetadata } from '@shared/instructions';
import { Message, ToolDefinition } from '@shared/types/chat';
import { JsonObject } from '@shared/types/common';
import { sanitizeObject } from '@shared/utils/sanitize.util';

import { getConversationLanguage } from './session-conversation-runtime.util';

export function injectConversationSystemPrompt(
    messages: Message[],
    provider: string,
    model: string,
    settingsService: SettingsService,
    localeService: LocaleService,
    permissionPolicy?: string,
    evidenceContext?: string
): Message[] {
    const settings = settingsService.getSettings();
    const configuredLanguage = getConversationLanguage(settingsService);
    const localePack = localeService.getLocalePack(configuredLanguage);
    const customPrompt = getCustomPrompt(settings, provider);
    const basePrompt = buildSystemPrompt({
        language: configuredLanguage,
        localeMetadata: toLocalePromptMetadata(localePack),
        provider,
        model,
    });
    const customPromptPart = customPrompt
        ? `\n\n## CUSTOM SYSTEM INSTRUCTIONS\n${customPrompt}`
        : '';
    const policyPart = permissionPolicy
        ? `\n\n## ACCESS POLICIES\n${permissionPolicy}`
        : '';
    const evidencePart = evidenceContext
        ? `\n\n## CURRENT EVIDENCE\n${evidenceContext}`
        : '';
    const finalInstruction = `${basePrompt}${customPromptPart}${policyPart}${evidencePart}`;

    const systemMessage = messages.find(message => message.role === 'system');
    if (systemMessage) {
        systemMessage.content = `${typeof systemMessage.content === 'string' ? systemMessage.content : ''}\n\n${finalInstruction}`;
        return messages;
    }

    return [{
        id: `system-${Date.now()}`,
        role: 'system',
        content: finalInstruction,
        timestamp: new Date(),
    } as Message, ...messages];
}

export function sanitizeConversationTools(
    tools: ToolDefinition[] | undefined
): ToolDefinition[] | undefined {
    return tools?.map(tool => ({
        type: tool.type,
        function: {
            name: tool.function.name,
            description: tool.function.description,
            parameters: tool.function.parameters
                ? sanitizeObject(tool.function.parameters) as JsonObject
                : undefined,
        },
    }));
}

function getCustomPrompt(settings: JsonObject, provider: string): string | undefined {
    const providerPrompt = (settings[provider] as JsonObject | undefined)?.['systemPrompt'];
    if (typeof providerPrompt === 'string') {
        return providerPrompt;
    }
    const aiPrompt = (settings['ai'] as JsonObject | undefined)?.['systemPrompt'];
    if (typeof aiPrompt === 'string') {
        return aiPrompt;
    }
    return undefined;
}
