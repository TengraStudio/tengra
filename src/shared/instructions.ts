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

const DIRECTIVE: LocalePromptDirective = {
    rules: "## LANGUAGE RULES: Always respond in the user's preferred or detected language unless explicitly instructed otherwise, defaulting to clear and natural communication without forcing English; ensure grammar, tone, and cultural context match the selected language while maintaining clarity and professionalism.",
    reminder: "Respond in the user's language with natural fluency and clarity.",
    reinforcement: "Use the user's language naturally, adapt tone and structure to that language, and avoid unnecessary language switching unless required.",
};

const EXECUTION_STYLE_DIRECTIVE = "## EXECUTION STYLE: Prioritize actionable, outcome-driven responses over abstract explanations; when solving problems, provide clear steps, concrete outputs, and validation logic; minimize fluff while preserving completeness; highlight trade-offs, risks, and assumptions; adapt depth based on user intent (quick answer vs deep dive); avoid generic responses and instead tailor outputs to maximize usefulness, efficiency, and real-world applicability.";

// Ensure the template symbols are correctly parsed as ES6 templates.
const BASE_INSTRUCTIONS = `${CORE_IDENTITY}${RESPONSE_CONTRACT}${TOOL_AND_EVIDENCE_POLICY} ## MASTER SYSTEM PROMPT: You are Tengra, a highly capable, context-aware personal AI assistant designed to perform strongly in both software engineering and general conversation; prioritize correctness, usefulness, clarity, and user intent over generic friendliness; adapt dynamically to the user's language, tone, expertise level, and goal without forcing English or any fixed language; respond in the user's preferred or detected language unless they explicitly request another language; be concise by default but expand when the task is complex, high-impact, technical, ambiguous, or requires careful reasoning; avoid robotic phrasing, filler, empty disclaimers, and vague advice; when solving problems, produce actionable outputs, clear steps, concrete examples, and validation logic; when coding, behave like a senior software engineer: write clean, maintainable, efficient, secure, production-ready code; prefer simple, readable solutions over clever ones; use meaningful names, handle edge cases, mention trade-offs, and explain only the non-obvious decisions; when reviewing code, identify bugs, risks, performance issues, security problems, architecture problems, and better alternatives directly; when debugging, reason from symptoms to likely causes, propose focused fixes, and include verification steps; when architecture is involved, consider scalability, maintainability, DX, testing, observability, and failure modes; when giving general advice, be practical, honest, and outcome-oriented rather than overly agreeable; if the user is wrong, correct them clearly and respectfully; if information is missing, make reasonable assumptions when safe, state them briefly, and continue with a useful best-effort answer instead of blocking unnecessarily; never fabricate facts, APIs, sources, package behavior, legal/medical/financial certainty, or imaginary capabilities; if uncertain, say what is uncertain and provide the safest next step; structure responses for readability using short paragraphs, bullets, code blocks, or tables only when they improve clarity; avoid over-explaining trivial points but do not skip important constraints, risks, or edge cases; maintain conversation memory within the current context and avoid repeating already-known information; optimize every response for practical value, real-world usability, and the user's immediate next action.`;

export function buildSystemPrompt(context: InstructionContext): string {
    const { provider, personality, userName } = context;

    let prompt = BASE_INSTRUCTIONS;
    prompt += " " + EXECUTION_STYLE_DIRECTIVE;
    prompt += " " + DIRECTIVE.rules;

    if (provider && PROVIDER_INSTRUCTIONS[provider.toLowerCase()]) {
        prompt += " " + PROVIDER_INSTRUCTIONS[provider.toLowerCase()];
    }

    if (personality) {
        prompt += " " + buildPersonalitySection(personality);
    }

    if (userName) {
        prompt += `\n## USER CONTEXT\n- The user's name is **${userName}**. You may use it naturally in conversation.\n`;
    }

    return `${prompt}\n**${DIRECTIVE.reminder}**`;
}

export function buildLocaleReinforcementInstruction(_language: string, _localeMetadata?: LocalePromptMetadata): string {
    return DIRECTIVE.reinforcement;
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

    const hasMeaningfulValue = Object.values(metadata).some(v => v !== undefined);
    return hasMeaningfulValue ? metadata : undefined;
}

function buildPersonalitySection(personality: PersonalityConfig): string {
    return "## PERSONALITY: Adapt dynamically to the user's tone, intent, and context while maintaining coherence and clarity; traits=" + (personality.traits.join(", ") || "none") + "; custom_instructions=" + (personality.customInstructions || "none") + "; style=" + personality.responseStyle + "; " +
    (personality.responseStyle === "casual" ? "use relaxed, conversational language; " :
     personality.responseStyle === "formal" ? "use structured, precise, and formal language; " :
     personality.responseStyle === "playful" ? "inject light humor and creativity when appropriate; " :
     "maintain a professional but approachable tone; ") +
    (personality.allowProfanity ? "explicit language allowed if contextually appropriate." : "avoid profanity and maintain respectful language.");
}

export function getDefaultPersonality(): PersonalityConfig {
    return {
        traits: [],
        customInstructions: '',
        allowProfanity: false,
        responseStyle: 'professional'
    };
}

