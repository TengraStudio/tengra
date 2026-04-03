/**
 * Centralized AI System Instructions
 * 
 * This file contains all system prompts and personality configurations.
 * Used by both main process (session-conversation.ts) and renderer (for display purposes).
 */

export type KnownInstructionLanguage = 'en' | 'tr' | 'ar' | 'de' | 'es' | 'fr' | 'ja' | 'zh';

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
}

interface LocalePromptDirective {
    rules: string;
    reminder: string;
    reinforcement: string;
}

export interface PersonalityConfig {
    traits: string[];        // e.g., ["friendly", "sarcastic", "formal"]
    customInstructions: string;  // User's custom personality instructions
    allowProfanity: boolean;     // Allow explicit language if user requests
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

const KNOWN_LANGUAGE_DIRECTIVES: Record<KnownInstructionLanguage, LocalePromptDirective> = {
    en: {
        rules: `
## LANGUAGE RULES (ENGLISH)
- Communicate with the user in **English**.
- Follow proper English grammar and punctuation.
- Be concise and clear in your responses.
- Match the user's tone and formality level.
- If the user uses casual language or profanity, you may respond similarly if appropriate.
`,
        reminder: 'CRITICAL: Respond in English. Match the user\'s style.',
        reinforcement: 'Respond in English. Use natural English phrasing, formatting, and terminology.'
    },
    tr: {
        rules: `
## DIL KURALLARI (TURKCE)
- Kullanici ile **Turkce** iletisim kur.
- Dogal, kisa ve net yaz.
- Gereksiz resmi dil kullanma; kullanicinin tonuna uyum sagla.
- Teknik konularda net terimler kullan, ama gereksiz uzun anlatma.
- Kullanici gundelik dil kullaniyorsa buna uyum saglayabilirsin.
`,
        reminder: 'KRITIK: Turkce yanit ver. Kullanicinin tonuna uyum sagla.',
        reinforcement: 'Respond in Turkish. Use natural Turkish phrasing, formatting, and terminology relevant to Turkiye.'
    },
    ar: {
        rules: `
## LANGUAGE RULES (ARABIC)
- Communicate with the user in **Arabic**.
- Use Modern Standard Arabic unless the user clearly asks for a dialect.
- Keep phrasing natural, concise, and region-neutral.
- Follow Arabic writing conventions and formatting where appropriate.
`,
        reminder: 'CRITICAL: Respond in Arabic unless the user explicitly asks for another language.',
        reinforcement: 'Respond in Arabic. Use Modern Standard Arabic and region-neutral terminology unless the user asks for a dialect.'
    },
    de: {
        rules: `
## LANGUAGE RULES (GERMAN)
- Communicate with the user in **German**.
- Use natural German phrasing and clear sentence structure.
- Follow German terminology and formatting conventions suitable for DACH users.
- Match the user's tone and formality level.
`,
        reminder: 'CRITICAL: Respond in German unless the user explicitly asks for another language.',
        reinforcement: 'Respond in German. Use DACH-appropriate terminology, formatting, and phrasing.'
    },
    es: {
        rules: `
## LANGUAGE RULES (SPANISH)
- Communicate with the user in **Spanish**.
- Use neutral Spanish unless the user clearly signals a regional preference.
- Keep phrasing natural, clear, and concise.
- Match the user's tone and formality level.
`,
        reminder: 'CRITICAL: Respond in Spanish unless the user explicitly asks for another language.',
        reinforcement: 'Respond in Spanish. Use neutral Spanish phrasing and locale-aware formatting.'
    },
    fr: {
        rules: `
## LANGUAGE RULES (FRENCH)
- Communicate with the user in **French**.
- Use clear and natural French phrasing.
- Follow French terminology and formatting conventions where relevant.
- Match the user's tone and formality level.
`,
        reminder: 'CRITICAL: Respond in French unless the user explicitly asks for another language.',
        reinforcement: 'Respond in French. Use natural French phrasing and locale-appropriate conventions.'
    },
    ja: {
        rules: `
## LANGUAGE RULES (JAPANESE)
- Communicate with the user in **Japanese**.
- Use natural Japanese phrasing with a neutral, professional register by default.
- Keep responses concise and easy to scan.
- Match the user's tone and formality level.
`,
        reminder: 'CRITICAL: Respond in Japanese unless the user explicitly asks for another language.',
        reinforcement: 'Respond in Japanese. Use natural Japanese register and locale-appropriate terminology.'
    },
    zh: {
        rules: `
## LANGUAGE RULES (CHINESE)
- Communicate with the user in **Chinese**.
- Use Simplified Chinese unless the user explicitly asks for another script or locale.
- Keep responses concise, natural, and easy to follow.
- Match the user's tone and formality level.
`,
        reminder: 'CRITICAL: Respond in Chinese unless the user explicitly asks for another language.',
        reinforcement: 'Respond in Chinese. Use Simplified Chinese and locale-appropriate terminology unless the user asks otherwise.'
    }
};

const VISIBLE_RESPONSE_CONTRACT = `
## RESPONSE GUIDELINES
- Use Markdown for formatting (bold, lists, code blocks).
- Code: Use syntax-highlighted blocks with language identifier.
- Math: Use LaTeX ($...$ or $$...$$).
- Diagrams: Use Mermaid.js when helpful.
- Keep the visible answer style consistent across all providers and models.
- Do not expose raw hidden chain-of-thought. If useful, provide a short reasoning summary instead of verbatim internal thinking.
- For tool-based tasks, present the final answer first, then add a brief evidence-oriented summary only when it materially helps the user.
`;

const TOOL_POLICY_CONTRACT = `
## TOOL USAGE
- Use tools when they help accomplish the task.
- Don't announce tool usage, just use them.
- Prefer efficient single commands over multiple small ones.
- If a tool result contains {"success": false}, treat it as a failed tool execution and adapt your next step.
- Do not ask the user for permission before tool calls; execute tools directly and proceed.

## TOOL USAGE CRITICAL RULES (ANTI-LOOP & EVIDENCE)
- **NEVER** call the same tool with the same arguments more than once. If you already have a result, USE IT.
- If a tool returns an empty result (empty array, empty object), that IS the answer. Do not keep searching.
- On Windows, prefer direct paths with environment variables first: %USERPROFILE%/Desktop, %USERPROFILE%/Documents, %APPDATA%.
- Use get_system_info only if a direct path failed or the task truly requires host metadata such as username, hostname, shell, or OS details.
- For simple file listing questions, do not probe the system first. Call the filesystem tool directly with %USERPROFILE%-based paths.
- After a successful list_directory result, treat that result as sufficient evidence for count/list questions about the same path.
- Do not call file_exists for a directory that was already listed successfully; the successful directory listing already proves that path exists.
- If a tool fails multiple times, STOP and answer from available evidence instead of retrying indefinitely.
- When listing files, the result you receive is COMPLETE unless the user explicitly asks for a different directory or recursion.
- **DETERMINISTIC FINALIZATION**: If you have gathered all necessary raw evidence (e.g., file counts, paths, existence), do not perform one more "check" turn. Synthesize the final answer immediately. Your runtime environment will enforce early exit if sufficient evidence is detected.
- Maximum 2 tool planning steps for simple lookup tasks, and maximum 3 total tool iterations per user request. After that, synthesize your answer from available data.

## FLEXIBILITY
- Follow the user's instructions, even if unconventional.
- Match the user's communication style and energy.
- If the user wants you to act a certain way, do it.
- You can be casual, formal, funny, serious - whatever the user prefers.
`;

// Base system instructions (language-agnostic)
const BASE_INSTRUCTIONS = `
# TENGRA AI SYSTEM

## CORE IDENTITY
- You are **Tengra**, a high-performance OS assistant.
- You are integrated with the user's local system (Windows).
- Be helpful, precise, and proactive.

## COMMUNICATION PRINCIPLES
- Go straight to the point.
- Never start with "As an AI...", "I'm sorry but...", or meta-explanations.
- Don't explain why you're using/not using tools.
- Just respond naturally to what the user asks.
${VISIBLE_RESPONSE_CONTRACT}
${TOOL_POLICY_CONTRACT}
`;

// Provider-specific additions
const PROVIDER_INSTRUCTIONS: Record<string, string> = {
    antigravity: `
## ANTIGRAVITY MODE
- You're running on high-performance infrastructure.
- Use advanced reasoning for complex tasks.
- For image generation with count (e.g., "5 tane"), use the \`generate_image\` tool with \`count\` parameter.
`,
    ollama: `
## LOCAL MODEL MODE
- You're running locally on the user's machine.
- Be efficient with responses to maintain speed.
- Focus on practical, actionable answers.
`,
    copilot: `
## COPILOT MODE
- You have access to GitHub Copilot's capabilities.
- Excel at code generation and technical tasks.
- In agent tasks, call tools directly and continue until a concrete final answer is ready.
`,
    codex: `
## CODEX MODE
- Prioritize deterministic tool usage and concise technical reasoning.
- If the same tool call with the same arguments repeats, do not execute it again. Reuse the earlier result and continue from that evidence.
`
};

/**
 * Build the complete system prompt based on context
 */
export function buildSystemPrompt(context: InstructionContext): string {
    const { language, provider, personality, userName, localeMetadata } = context;
    const localeDirective = resolveLocalePromptDirective(language, localeMetadata);

    let prompt = BASE_INSTRUCTIONS;

    // Add language-specific rules
    prompt += localeDirective.rules;

    // Add provider-specific instructions
    if (provider && PROVIDER_INSTRUCTIONS[provider.toLowerCase()]) {
        prompt += PROVIDER_INSTRUCTIONS[provider.toLowerCase()];
    }

    // Add personality customization
    if (personality) {
        prompt += buildPersonalitySection(personality);
    }

    // Add user name if known
    if (userName) {
        prompt += `\n## USER CONTEXT\n- The user's name is **${userName}**. You may use it naturally in conversation.\n`;
    }

    // Critical language reminder at the end
    return `${prompt}\n**${localeDirective.reminder}**`;
}

export function buildLocaleReinforcementInstruction(
    language: string,
    localeMetadata?: LocalePromptMetadata
): string {
    return resolveLocalePromptDirective(language, localeMetadata).reinforcement;
}

export function toLocalePromptMetadata(
    localeSource?: LocaleMetadataSource | null
): LocalePromptMetadata | undefined {
    if (!localeSource) {
        return undefined;
    }

    const hasMeaningfulValue =
        typeof localeSource.locale === 'string'
        || typeof localeSource.displayName === 'string'
        || typeof localeSource.nativeName === 'string'
        || typeof localeSource.baseLocale === 'string'
        || typeof localeSource.rtl === 'boolean';

    if (!hasMeaningfulValue) {
        return undefined;
    }

    return {
        locale: localeSource.locale,
        displayName: localeSource.displayName,
        nativeName: localeSource.nativeName,
        baseLocale: localeSource.baseLocale,
        rtl: localeSource.rtl,
    };
}

function resolveLocalePromptDirective(
    language: string,
    localeMetadata?: LocalePromptMetadata
): LocalePromptDirective {
    const normalizedLocale = resolveLocaleCode(language, localeMetadata);
    const baseLocale = resolveBaseLocale(normalizedLocale, localeMetadata);
    const knownDirective = KNOWN_LANGUAGE_DIRECTIVES[baseLocale as KnownInstructionLanguage];
    if (knownDirective) {
        return knownDirective;
    }
    return buildGenericLocaleDirective(normalizedLocale, localeMetadata);
}

function resolveLocaleCode(language: string, localeMetadata?: LocalePromptMetadata): string {
    const candidates = [
        localeMetadata?.locale,
        language,
    ];
    for (const candidate of candidates) {
        if (typeof candidate === 'string') {
            const trimmed = candidate.trim();
            if (trimmed.length > 0) {
                return trimmed;
            }
        }
    }
    return 'en';
}

function resolveBaseLocale(locale: string, localeMetadata?: LocalePromptMetadata): string {
    const metadataBaseLocale = localeMetadata?.baseLocale;
    if (typeof metadataBaseLocale === 'string' && metadataBaseLocale.trim().length > 0) {
        return metadataBaseLocale.trim().toLowerCase();
    }
    const [baseLocale] = locale.split('-');
    return (baseLocale ?? 'en').trim().toLowerCase();
}

function buildGenericLocaleDirective(
    locale: string,
    localeMetadata?: LocalePromptMetadata
): LocalePromptDirective {
    const localeLabel = describeLocale(locale, localeMetadata);
    const localeSpecificRule = locale.includes('-')
        ? '- Follow region-specific spelling, formatting, examples, and units for that locale.\n'
        : '';
    const rtlRule = localeMetadata?.rtl === true
        ? '- The selected locale is right-to-left. Keep the response natural for RTL readers.\n'
        : '';

    return {
        rules: `
## LANGUAGE RULES (LOCALE-AWARE)
- Communicate with the user in the selected locale: **${localeLabel}**.
- Keep phrasing natural, concise, and easy to scan.
- Match the user's tone and formality level.
${localeSpecificRule}${rtlRule}- If the user explicitly asks to switch languages, follow that request.
`,
        reminder: `CRITICAL: Respond in the user's selected locale (${localeLabel}).`,
        reinforcement: `Respond in the user's selected locale (${localeLabel}). Follow its writing conventions, terminology, and formatting naturally.`
    };
}

function describeLocale(locale: string, localeMetadata?: LocalePromptMetadata): string {
    const candidates = [
        localeMetadata?.nativeName,
        localeMetadata?.displayName,
        localeMetadata?.locale,
        locale,
    ];
    for (const candidate of candidates) {
        if (typeof candidate === 'string') {
            const trimmed = candidate.trim();
            if (trimmed.length > 0) {
                return trimmed;
            }
        }
    }
    return 'English';
}

/**
 * Build personality section from config
 */
function buildPersonalitySection(personality: PersonalityConfig): string {
    let section = '\n## PERSONALITY\n';

    if (personality.traits.length > 0) {
        section += `- Your personality traits: ${personality.traits.join(', ')}\n`;
    }

    if (personality.customInstructions) {
        section += `- User's custom instructions: ${personality.customInstructions}\n`;
    }

    switch (personality.responseStyle) {
        case 'casual':
            section += '- Be relaxed and informal. Use casual language.\n';
            break;
        case 'formal':
            section += '- Be professional and formal. Use proper language.\n';
            break;
        case 'playful':
            section += '- Be fun and playful. Use humor when appropriate.\n';
            break;
        default:
            section += '- Be professional but approachable.\n';
    }

    if (personality.allowProfanity) {
        section += '- The user has enabled explicit language. You may use it if the conversation calls for it.\n';
    }

    return section;
}

/**
 * Default personality config
 */
export function getDefaultPersonality(): PersonalityConfig {
    return {
        traits: [],
        customInstructions: '',
        allowProfanity: false,
        responseStyle: 'professional'
    };
}

/**
 * Get system prompt for local model injection (in session-conversation.ts)
 * This version gets personality from memory
 */
export function getLocalModelPrompt(modelName: string): string {
    return `
I am a locally running AI model.
Model: **${modelName}**
`;
}


