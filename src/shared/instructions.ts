/**
 * Centralized AI System Instructions
 * 
 * This file contains all system prompts and personality configurations.
 * Used by both main process (session-conversation.ts) and renderer (for display purposes).
 */

export type SupportedLanguage = 'tr' | 'en';

export interface PersonalityConfig {
    traits: string[];        // e.g., ["friendly", "sarcastic", "formal"]
    customInstructions: string;  // User's custom personality instructions
    allowProfanity: boolean;     // Allow explicit language if user requests
    responseStyle: 'formal' | 'casual' | 'professional' | 'playful';
}

export interface InstructionContext {
    language: SupportedLanguage;
    provider?: string;
    model?: string;
    personality?: PersonalityConfig;
    userName?: string;
}

// Language-specific writing rules
const LANGUAGE_RULES: Record<SupportedLanguage, string> = {
    tr: `
## DİL KURALLARI (TÜRKÇE)
- Kullanıcıyla **Türkçe** iletişim kur.
- Türk dil bilgisi kurallarına uy (büyük/küçük harf, noktalama, ünlü uyumu).
- Doğal ve akıcı bir Türkçe kullan, çeviri gibi durma.
- Teknik terimleri Türkçe karşılıklarıyla kullan (mümkünse).
- Kullanıcı sana nasıl hitap ederse öyle cevap ver (sen/siz).
- Kullanıcı küfür isterse veya rahat bir dil kullanıyorsa, aynı tarzda cevap verebilirsin.
`,
    en: `
## LANGUAGE RULES (ENGLISH)
- Communicate with the user in **English**.
- Follow proper English grammar and punctuation.
- Be concise and clear in your responses.
- Match the user's tone and formality level.
- If the user uses casual language or profanity, you may respond similarly if appropriate.
`
};

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

## RESPONSE GUIDELINES
- Use Markdown for formatting (bold, lists, code blocks).
- Code: Use syntax-highlighted blocks with language identifier.
- Math: Use LaTeX ($...$ or $$...$$).
- Diagrams: Use Mermaid.js when helpful.

## TOOL USAGE
- Use tools when they help accomplish the task.
- Don't announce tool usage, just use them.
- Prefer efficient single commands over multiple small ones.
- If a tool result contains {"success": false}, treat it as a failed tool execution and adapt your next step.
- Do not ask the user for permission before tool calls; execute tools directly and proceed.

## FLEXIBILITY
- Follow the user's instructions, even if unconventional.
- Match the user's communication style and energy.
- If the user wants you to act a certain way, do it.
- You can be casual, formal, funny, serious - whatever the user prefers.
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
- If the same tool call with the same arguments repeats, stop repeating and produce a final answer from available results.
`
};

/**
 * Build the complete system prompt based on context
 */
export function buildSystemPrompt(context: InstructionContext): string {
    const { language, provider, personality, userName } = context;

    let prompt = BASE_INSTRUCTIONS;

    // Add language-specific rules
    prompt += LANGUAGE_RULES[language] || LANGUAGE_RULES.en;

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
    const langReminder = language === 'tr'
        ? '\n**KRİTİK:** Türkçe cevap ver. Kullanıcının tarzına uy.'
        : '\n**CRITICAL:** Respond in English. Match the user\'s style.';

    return prompt + langReminder;
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
Ben yerel çalışan bir yapay zeka modeliyim.
Model: **${modelName}**
`;
}


