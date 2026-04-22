/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * Centralized AI System Instructions
 * 
 * This file handles logic for assembling system prompts.
 * The core text content lies in src/shared/prompts/*.
 */
import {
    CORE_IDENTITY,
    PROVIDER_INSTRUCTIONS,
    RESPONSE_CONTRACT,
    TOOL_AND_EVIDENCE_POLICY
} from './prompts';

export type KnownInstructionLanguage = string; // Deprecated strict union, now accepts any marketplace locale tag

export interface LocalePromptMetadata {
    locale?: string;
    displayName?: string;
    nativeName?: string;
    baseLocale?: string;
    rtl?: boolean;
    rules?: string;
    reminder?: string;
    reinforcement?: string;
}

interface LocaleMetadataSource {
    locale?: string;
    displayName?: string;
    nativeName?: string;
    baseLocale?: string;
    rtl?: boolean;
    translations?: import('@shared/types/common').JsonValue;
}

interface LocalePromptDirective {
    rules: string;
    reminder: string;
    reinforcement: string;
}

export interface PersonalityConfig {
    traits: string[];
    customInstructions: string;
    allowProfanity: boolean;
    responseStyle: 'formal' | 'casual' | 'professional' | 'playful';
}

export interface InstructionContext {
    language: string;
    provider?: string;
    model?: string;
    personality?: PersonalityConfig;
    userName?: string;
    localeMetadata?: LocalePromptMetadata;
}

const DEFAULT_DIRECTIVE: LocalePromptDirective = {
    rules: `\n## LANGUAGE RULES (DEFAULT)\n- Primarily communicate with the user in their preferred language.\n- Match tone and formality naturally.\n`,
    reminder: "Match the user's language.",
    reinforcement: "Respond in the user's message language and follow its conventions.",
};

const EXECUTION_STYLE_DIRECTIVE = `
## EXECUTION STYLE
- Prioritize practical execution over lengthy theorizing.
- When the user asks for implementation, produce concrete changes and verification.
- Keep responses concise but complete: outcome, key changes, validation, and residual risk.
`;

const KNOWN_LOCALE_DIRECTIVES: Record<string, LocalePromptDirective> = {
    tr: {
        rules: `\n## DIL KURALLARI (TURKCE)\n- Turkce yanit ver.\n- Kullanici baska bir dil istemedikce Turkce kal.\n`,
        reminder: 'Turkce yanit ver.',
        reinforcement: 'Turkce yanit ver ve dogal Turkce kullanimina uy.',
    },
    de: {
        rules: `\n## LANGUAGE RULES (GERMAN)\n- Respond in German.\n- Use natural German phrasing unless the user asks otherwise.\n`,
        reminder: 'Respond in German.',
        reinforcement: 'Respond in German and follow natural German conventions.',
    },
};
 
// Ensure the template symbols are correctly parsed as ES6 templates.
const BASE_INSTRUCTIONS = `${CORE_IDENTITY}${RESPONSE_CONTRACT}${TOOL_AND_EVIDENCE_POLICY}`;

export function buildSystemPrompt(context: InstructionContext): string {
    const { language, provider, personality, userName, localeMetadata } = context;
    const localeDirective = resolveLocalePromptDirective(language, localeMetadata);

    let prompt = BASE_INSTRUCTIONS;
    prompt += EXECUTION_STYLE_DIRECTIVE;
    prompt += localeDirective.rules;

    if (provider && PROVIDER_INSTRUCTIONS[provider.toLowerCase()]) {
        prompt += PROVIDER_INSTRUCTIONS[provider.toLowerCase()];
    }

    if (personality) {
        prompt += buildPersonalitySection(personality);
    }

    if (userName) {
        prompt += `\n## USER CONTEXT\n- The user's name is **${userName}**. You may use it naturally in conversation.\n`;
    }

    return `${prompt}\n**${localeDirective.reminder}**`;
}

export function buildLocaleReinforcementInstruction(language: string, localeMetadata?: LocalePromptMetadata): string {
    return resolveLocalePromptDirective(language, localeMetadata).reinforcement;
}

export function toLocalePromptMetadata(localeSource?: LocaleMetadataSource | null): LocalePromptMetadata | undefined {
    if (!localeSource) { return undefined; }

    const metadata: LocalePromptMetadata = {
        locale: localeSource.locale,
        displayName: localeSource.displayName,
        nativeName: localeSource.nativeName,
        baseLocale: localeSource.baseLocale,
        rtl: localeSource.rtl,
    };

    if (localeSource.translations && typeof localeSource.translations === 'object') {
        const t = localeSource.translations as Record<string, unknown>;

        const findPrompt = (obj: Record<string, unknown>, path: string): string | undefined => {
            if (typeof obj[path] === 'string') { return obj[path] as string; }
            const parts = path.split('.');
            let current: unknown = obj;
            for (const part of parts) {
                if (current && typeof current === 'object' && current !== null && part in current) {
                    current = (current as Record<string, unknown>)[part];
                } else {
                    return undefined;
                }
            }
            return typeof current === 'string' ? current : undefined;
        };

        const rules = findPrompt(t, 'system.instructions.rules');
        const reminder = findPrompt(t, 'system.instructions.reminder');
        const reinforcement = findPrompt(t, 'system.instructions.reinforcement');

        if (rules) { metadata.rules = rules; }
        if (reminder) { metadata.reminder = reminder; }
        if (reinforcement) { metadata.reinforcement = reinforcement; }
    }

    const hasMeaningfulValue = Object.values(metadata).some(v => v !== undefined);
    return hasMeaningfulValue ? metadata : undefined;
}

function resolveLocalePromptDirective(language: string, localeMetadata?: LocalePromptMetadata): LocalePromptDirective {
    if (localeMetadata?.rules && localeMetadata?.reminder && localeMetadata?.reinforcement) {
        return {
            rules: localeMetadata.rules,
            reminder: localeMetadata.reminder,
            reinforcement: localeMetadata.reinforcement,
        };
    }

    const normalizedLanguage = normalizeLanguageTag(language) || normalizeLanguageTag(localeMetadata?.locale);
    if (normalizedLanguage === 'en') {
        return {
            rules: `\n## LANGUAGE RULES (ENGLISH)\n- Respond in English.\n`,
            reminder: 'Respond in English.',
            reinforcement: 'Respond in English and follow natural English conventions.',
        };
    }
    if (normalizedLanguage && KNOWN_LOCALE_DIRECTIVES[normalizedLanguage]) {
        return KNOWN_LOCALE_DIRECTIVES[normalizedLanguage];
    }

    const localeAwareDirective = createLocaleAwareDirective(localeMetadata);
    return localeAwareDirective ?? DEFAULT_DIRECTIVE;
}

function normalizeLanguageTag(language?: string): string | undefined {
    if (!language) { return undefined; }
    return language.trim().toLowerCase().split(/[-_]/)[0];
}

function createLocaleAwareDirective(localeMetadata?: LocalePromptMetadata): LocalePromptDirective | undefined {
    const localeLabel = localeMetadata?.nativeName || localeMetadata?.displayName || localeMetadata?.locale;
    if (!localeLabel) { return undefined; }

    return {
        rules: `\n## LANGUAGE RULES (LOCALE-AWARE)\n- Preferred locale: ${localeLabel}\n- Match spelling, tone, and conventions for ${localeLabel}.\n`,
        reminder: `Respond in the user's selected locale (${localeLabel}).`,
        reinforcement: `Respond in the user's selected locale (${localeLabel}) and follow its conventions.`,
    };
}

function buildPersonalitySection(personality: PersonalityConfig): string {
    let section = '\n## PERSONALITY\n';

    if (personality.traits.length > 0) {
        section += `- Your personality traits: ${personality.traits.join(', ')}\n`;
    }

    if (personality.customInstructions) {
        section += `- User's custom instructions: ${personality.customInstructions}\n`;
    }

    switch (personality.responseStyle) {
        case 'casual': section += '- Be relaxed and informal. Use casual language.\n'; break;
        case 'formal': section += '- Be professional and formal. Use proper language.\n'; break;
        case 'playful': section += '- Be fun and playful. Use humor when appropriate.\n'; break;
        default: section += '- Be professional but approachable.\n';
    }

    if (personality.allowProfanity) {
        section += '- The user has enabled explicit language. You may use it if the conversation calls for it.\n';
    }

    return section;
}

export function getDefaultPersonality(): PersonalityConfig {
    return {
        traits: [],
        customInstructions: '',
        allowProfanity: false,
        responseStyle: 'professional'
    };
}
