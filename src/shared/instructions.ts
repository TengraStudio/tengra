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
    // Dynamic prompts from locale packs (plugins)
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

/**
 * Built-in language directives as fallbacks.
 * In production, these are increasingly served by marketplace-installed locale packs.
 */
/**
 * Default generic directives in case no plugin provides them.
 */
const DEFAULT_DIRECTIVE: LocalePromptDirective = {
    rules: `
## LANGUAGE RULES (DEFAULT)
- Primarily communicate with the user in their preferred language.
- Match tone and formality naturally.
`,
    reminder: 'Match the user\'s language.',
    reinforcement: 'Respond in the user\'s message language and follow its conventions.'
};

const BUILTIN_LANGUAGE_DIRECTIVES: Record<KnownInstructionLanguage, LocalePromptDirective> = {
    en: {
        rules: `
## LANGUAGE RULES (ENGLISH)
- Respond in English.
`,
        reminder: 'Respond in English.',
        reinforcement: 'Respond in English and follow natural English conventions.',
    },
    tr: {
        rules: `
## DIL KURALLARI (TURKCE)
- Turkce yanit ver.
`,
        reminder: 'Turkce yanit ver.',
        reinforcement: 'Turkce yanit ver ve Turkce dil kurallarina uy.',
    },
    ar: {
        rules: `
## LANGUAGE RULES (ARABIC)
- Respond in Arabic.
`,
        reminder: 'Respond in Arabic.',
        reinforcement: 'Respond in Arabic and follow Arabic conventions.',
    },
    de: {
        rules: `
## LANGUAGE RULES (GERMAN)
- Respond in German.
`,
        reminder: 'Respond in German.',
        reinforcement: 'Respond in German and follow German conventions.',
    },
    es: {
        rules: `
## LANGUAGE RULES (SPANISH)
- Respond in Spanish.
`,
        reminder: 'Respond in Spanish.',
        reinforcement: 'Respond in Spanish and follow Spanish conventions.',
    },
    fr: {
        rules: `
## LANGUAGE RULES (FRENCH)
- Respond in French.
`,
        reminder: 'Respond in French.',
        reinforcement: 'Respond in French and follow French conventions.',
    },
    ja: {
        rules: `
## LANGUAGE RULES (JAPANESE)
- Respond in Japanese.
`,
        reminder: 'Respond in Japanese.',
        reinforcement: 'Respond in Japanese and follow Japanese conventions.',
    },
    zh: {
        rules: `
## LANGUAGE RULES (CHINESE)
- Respond in Chinese.
`,
        reminder: 'Respond in Chinese.',
        reinforcement: 'Respond in Chinese and follow Chinese conventions.',
    },
};

function normalizeLanguageTag(language?: string): KnownInstructionLanguage | undefined {
    if (!language) {
        return undefined;
    }

    const normalized = language.trim().toLowerCase();
    const base = normalized.split(/[-_]/)[0];
    const knownLanguages = new Set<KnownInstructionLanguage>(['en', 'tr', 'ar', 'de', 'es', 'fr', 'ja', 'zh']);
    if (knownLanguages.has(normalized as KnownInstructionLanguage)) {
        return normalized as KnownInstructionLanguage;
    }
    if (knownLanguages.has(base as KnownInstructionLanguage)) {
        return base as KnownInstructionLanguage;
    }
    return undefined;
}

function createLocaleAwareDirective(localeMetadata?: LocalePromptMetadata): LocalePromptDirective | undefined {
    const localeLabel = localeMetadata?.nativeName || localeMetadata?.displayName || localeMetadata?.locale;
    if (!localeLabel) {
        return undefined;
    }

    return {
        rules: `
## LANGUAGE RULES (LOCALE-AWARE)
- Preferred locale: ${localeLabel}
- Match spelling, tone, and conventions for ${localeLabel}.
`,
        reminder: `Respond in the user's selected locale (${localeLabel}).`,
        reinforcement: `Respond in the user's selected locale (${localeLabel}) and follow its conventions.`,
    };
}


const CORE_IDENTITY = `
# TENGRA AI SYSTEM

## CORE IDENTITY
- You are **Tengra**, a high-performance OS assistant.
- You are integrated with the user's local system (Windows).
- Be helpful, precise, and proactive.
- **LANGUAGE FLEXIBILITY**: Always respond in the same language as the user's latest message.
`;

const RESPONSE_CONTRACT = `
## RESPONSE CONTRACT
- Use Markdown for formatting (bold, lists, code blocks).
- Code: Use syntax-highlighted blocks with language identifier.
- Math: Use LaTeX ($...$ or $$...$$).
- Diagrams: Use Mermaid.js when helpful.
- Keep the visible answer style consistent across all providers and models.
- Do not expose raw hidden chain-of-thought. If useful, provide a short reasoning summary instead of verbatim internal thinking.
- For tool-based tasks, present the final answer first, then add a brief evidence-oriented summary only when it materially helps the user.
- While tools are running, provide short in-language progress text so the user can follow what is happening.
- Go straight to the point.
- Never start with "As an AI...", "I'm sorry but...", or meta-explanations.
- Don't explain why you're using/not using tools.
- Just respond naturally to what the user asks.
`;

const TOOL_AND_EVIDENCE_POLICY = `
## TOOL & EVIDENCE POLICY
- Use tools when they help accomplish the task.
- Don't announce tool usage, just use them.
- Prefer efficient single commands over multiple small ones.
- If a tool result contains {"success": false}, treat it as a failed tool execution and adapt your next step.
- Do not ask the user for permission before tool calls; execute tools directly and proceed.
- If the user asks you to create, modify, or place code/files in a local folder, create the files with tools. Do not answer with manual code blocks unless the user asks only for examples or snippets.
- Prefer \`create_directory\`, \`write_file\`, and \`write_files\` for project scaffolding. Use \`terminal_session_start\` + \`terminal_session_write/read/wait\` for multi-step shell work, dev servers, watchers, interactive prompts, or when cwd/env/history must persist. Use \`execute_command\` only for short one-shot package manager/build commands.
- When targeting an existing parent folder such as Desktop\\\\projects, verify or reuse that folder before creating nested project files. Create only one top-level project folder unless the user asks for multiple folders.
- Before emitting any tool call, ensure every required argument is present and non-empty. Never send empty strings, empty arrays, or structurally incomplete arguments just to "try" a tool.
- For filesystem and scaffolding tools, infer the intended path from the user request or prior evidence first. If the path is still unknown, stop using that tool and answer from available evidence instead of repeating an invalid call.

### ANTI-LOOP & DETERMINISTIC FINALIZATION
- **NEVER** call the same tool with the same arguments more than once. If you already have a result, USE IT.
- If a tool returns an empty result (empty array, empty object), that IS the answer. Do not keep searching.
- On Windows, for filesystem tool path arguments (\`read_file\`, \`list_directory\`, \`file_exists\`), prefer direct env-var paths first: %USERPROFILE%\\\\Desktop, %USERPROFILE%\\\\Documents, %APPDATA%.
- For \`terminal_session_write\` and \`execute_command\`, use PowerShell syntax (\`$env:USERPROFILE\`, \`Test-Path\`, \`Get-ChildItem\`, \`New-Item\`) and avoid CMD-only syntax (\`%USERPROFILE%\`, \`if not exist\`, \`dir\`).
- After writing to a persistent terminal, call \`terminal_session_wait\` or \`terminal_session_read\` to inspect output before deciding the next step.
- For multi-line PowerShell, keep statements syntactically valid. If a command fails, read the returned \`error\`, \`stderr\`, and \`exitCode\` fields and change approach instead of retrying the same operation.
- Use get_system_info only if a direct path failed or the task truly requires host metadata.
- For simple file listing questions, do not probe the system first. Call the filesystem tool directly with %USERPROFILE%-based paths.
- After a successful list_directory result, treat that result as sufficient evidence for count/list questions about the same path.
- Do not call file_exists for a directory that was already listed successfully.
- If a tool fails multiple times, STOP and answer from available evidence instead of retrying indefinitely.
- If a tool result is cached or repeats prior evidence, treat it as no new progress and move to a final answer or a genuinely different tool.
- When listing files, the result you receive is COMPLETE unless the user explicitly asks for a different directory or recursion.
- **DETERMINISTIC FINALIZATION**: If you have gathered all necessary raw evidence (e.g., file counts, paths, existence), synthesize the final answer immediately.
- Synthesize your final answer from available evidence once the task is complete.

### TOOL CONVERGENCE RULES
- Never retry the same tool family (e.g., resolve_path, list_directory, file_exists) for the same target after one successful result.
- Never call resolve_path more than once per user request unless the user explicitly asks for a different path.
- Once path evidence exists (from resolve_path or list_directory), move directly to creation, writing, or finalization. Do not probe or verify the path again.
- If a required argument is unknown or empty, stop and answer from available evidence rather than sending an incomplete tool call.
- Do not issue the same tool with only minor argument variations (e.g., different path separators, tilde vs env-var). These are semantically identical.
- When you have gathered enough evidence for the final answer, stop calling tools immediately and synthesize your response.

## FLEXIBILITY
- Follow the user's instructions, even if unconventional.
- Match the user's communication style and energy.
- You can be casual, formal, funny, serious - whatever the user prefers.
`;

// Base system instructions (assembled from modular sections)
const BASE_INSTRUCTIONS = `${CORE_IDENTITY}${RESPONSE_CONTRACT}${TOOL_AND_EVIDENCE_POLICY}`;

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

    const metadata: LocalePromptMetadata = {
        locale: localeSource.locale,
        displayName: localeSource.displayName,
        nativeName: localeSource.nativeName,
        baseLocale: localeSource.baseLocale,
        rtl: localeSource.rtl,
    };

    // Extract dynamic prompts from translations if present (plugin system support)
    if (localeSource.translations && typeof localeSource.translations === 'object') {
        const t = localeSource.translations as Record<string, unknown>;

        // Helper to safely extract a string from possibly nested i18n structure without 'any'
        const findPrompt = (obj: Record<string, unknown>, path: string): string | undefined => {
            // Check flat first
            if (typeof obj[path] === 'string') {
                return obj[path] as string;
            }
            // Fallback to nested
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

        if (rules) {
            metadata.rules = rules;
        }
        if (reminder) {
            metadata.reminder = reminder;
        }
        if (reinforcement) {
            metadata.reinforcement = reinforcement;
        }
    }

    const hasMeaningfulValue = Object.values(metadata).some(v => v !== undefined);
    return hasMeaningfulValue ? metadata : undefined;
}

function resolveLocalePromptDirective(
    language: string,
    localeMetadata?: LocalePromptMetadata
): LocalePromptDirective {
    // 1. First priority: Directives provided by the locale pack plugin
    if (localeMetadata?.rules && localeMetadata?.reminder && localeMetadata?.reinforcement) {
        return {
            rules: localeMetadata.rules,
            reminder: localeMetadata.reminder,
            reinforcement: localeMetadata.reinforcement,
        };
    }

    // 2. Built-in directives for known locales
    const normalizedLanguage = normalizeLanguageTag(language)
        || normalizeLanguageTag(localeMetadata?.locale)
        || normalizeLanguageTag(localeMetadata?.baseLocale);
    if (normalizedLanguage) {
        return BUILTIN_LANGUAGE_DIRECTIVES[normalizedLanguage];
    }

    // 3. Locale-aware fallback using marketplace metadata
    const localeAwareDirective = createLocaleAwareDirective(localeMetadata);
    if (localeAwareDirective) {
        return localeAwareDirective;
    }

    // 4. Final resort: default fallback
    return DEFAULT_DIRECTIVE;
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
