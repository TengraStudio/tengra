import { SystemMode } from '@shared/types/chat';

/** Reasoning model type categories. */
export type ReasoningModelType = 'openai' | 'gemini3' | 'gemini25' | 'claude';

/**
 * Detects whether a model supports reasoning and returns its type.
 * @param model - The model identifier string.
 * @returns The reasoning model type or null if not a reasoning model.
 */
export function detectReasoningModelType(model: string): ReasoningModelType | null {
    const m = model.toLowerCase();

    if (isOpenAIReasoningModel(m)) { return 'openai'; }
    if (/gemini-3\.?/.test(m)) { return 'gemini3'; }
    if (/gemini-2[.-]5/.test(m)) { return 'gemini25'; }
    if (isClaudeThinkingModel(m)) { return 'claude'; }

    return null;
}

/**
 * Checks if the model is an OpenAI reasoning model (o-series, GPT-5, Grok-code).
 * @param m - Lowercased model name.
 */
export function isOpenAIReasoningModel(m: string): boolean {
    return /^o[134](-|$)/.test(m) ||
        (m.startsWith('gpt-5') && !m.includes('mini')) ||
        (m.includes('grok') && m.includes('code'));
}

/**
 * Checks if the model is a Claude thinking-capable model.
 * @param m - Lowercased model name.
 */
export function isClaudeThinkingModel(m: string): boolean {
    if (!m.includes('claude')) { return false; }
    return /opus-4|sonnet-4|haiku-4\.5|4-[15]-|4\.[15]-/.test(m);
}

/**
 * Resolves the effort level from explicit setting or system mode.
 * @param reasoningEffort - Optional explicit effort string.
 * @param systemMode - Optional system mode (thinking/fast).
 * @returns The resolved effort level string.
 */
export function resolveEffortLevel(reasoningEffort?: string, systemMode?: SystemMode): string {
    if (reasoningEffort) { return reasoningEffort; }
    const modeMap: Record<string, string> = { 'thinking': 'high', 'fast': 'low' };
    return modeMap[systemMode ?? ''] ?? 'medium';
}

/**
 * Returns the Gemini thinking budget for a given effort level.
 * @param effort - The effort level string.
 */
export function getGeminiBudget(effort: string): number {
    const budgetMap: Record<string, number> = { 'minimal': 128, 'low': 2048, 'medium': 8192, 'high': 16384 };
    return budgetMap[effort] ?? 8192;
}

/**
 * Returns the Claude thinking budget for a given effort level.
 * @param effort - The effort level string.
 */
export function getClaudeBudget(effort: string): number {
    const budgetMap: Record<string, number> = { 'low': 2048, 'medium': 8192, 'high': 16384 };
    return budgetMap[effort] ?? 8192;
}

/**
 * Applies reasoning effort configuration to an OpenAI-compatible request body.
 * @param body - The request body to mutate.
 * @param model - The model identifier.
 * @param systemMode - Optional system mode.
 * @param reasoningEffort - Optional explicit effort level.
 */
export function applyReasoningEffort(
    body: Record<string, unknown>,
    model: string,
    systemMode?: SystemMode,
    reasoningEffort?: string
): void {
    const modelType = detectReasoningModelType(model);
    if (!modelType) { return; }

    const effort = resolveEffortLevel(reasoningEffort, systemMode);

    switch (modelType) {
        case 'openai':
            body.reasoning_effort = effort;
            break;
        case 'gemini3':
            body.thinking_level = effort;
            break;
        case 'gemini25':
            body.thinking_budget = getGeminiBudget(effort);
            break;
        case 'claude':
            body.thinking = { type: 'enabled', budget_tokens: getClaudeBudget(effort) };
            break;
    }
}
