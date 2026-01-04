
export type ModelProvider = 'copilot' | 'openai' | 'anthropic' | 'gemini' | 'ollama' | 'antigravity' | 'custom';

export interface ModelDefinition {
    id: string;
    label: string;
    provider: ModelProvider;
    family?: string;
}

/**
 * Explicit definition map for known IDs to their Canonical representation.
 * These are the models we "support" and will always show in the UI if possible.
 */
export const KNOWN_DEFINITIONS: Record<string, Record<string, ModelDefinition>> = {
    'copilot': {
        // GitHub Copilot - Standard
        'gpt-4o': { id: 'gpt-4o', label: 'GPT-4o', provider: 'copilot' },
        'gpt-4': { id: 'gpt-4', label: 'GPT-4', provider: 'copilot' },
        'gpt-4-turbo': { id: 'gpt-4-turbo', label: 'GPT-4 Turbo', provider: 'copilot' },
        'gpt-3.5-turbo': { id: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo', provider: 'copilot' },
        'claude-3.5-sonnet': { id: 'claude-3.5-sonnet', label: 'Claude 3.5 Sonnet', provider: 'copilot' },

        // GitHub Copilot - Extended / Experimental
        'gpt-5': { id: 'gpt-5', label: 'GPT-5', provider: 'copilot' },
        'gpt-5-preview': { id: 'gpt-5-preview', label: 'GPT-5 (Preview)', provider: 'copilot' },
        'gpt-5.1': { id: 'gpt-5.1', label: 'GPT-5.1', provider: 'copilot' },
        'gpt-5-codex': { id: 'gpt-5-codex', label: 'GPT-5 Codex', provider: 'copilot' },
        'gpt-5.1-codex': { id: 'gpt-5.1-codex', label: 'GPT-5.1 Codex', provider: 'copilot' },
        'gpt-5-codex-mini': { id: 'gpt-5-codex-mini', label: 'GPT-5 Codex Mini', provider: 'copilot' },
        'gpt-5.1-codex-mini': { id: 'gpt-5.1-codex-mini', label: 'GPT-5.1 Codex Mini', provider: 'copilot' },
        'o1': { id: 'o1', label: 'o1', provider: 'copilot' },
        'o1-preview': { id: 'o1-preview', label: 'o1 Preview', provider: 'copilot' },
        'o1-mini': { id: 'o1-mini', label: 'o1 Mini', provider: 'copilot' },
        'gpt-4.1': { id: 'gpt-4.1', label: 'GPT-4.1', provider: 'copilot' },
        'claude-sonnet-4': { id: 'claude-sonnet-4', label: 'Claude 4 Sonnet', provider: 'copilot' },
        'gemini-3-flash': { id: 'gemini-3-flash', label: 'Gemini 3 Flash', provider: 'copilot' },
        'gemini-3-pro': { id: 'gemini-3-pro', label: 'Gemini 3 Pro', provider: 'copilot' },
        'raptor-mini': { id: 'raptor-mini', label: 'Raptor Mini', provider: 'copilot' },
    },
    'openai': {
        // OpenAI - Standard
        'gpt-4o': { id: 'gpt-4o', label: 'GPT-4o', provider: 'openai' },
        'gpt-4': { id: 'gpt-4', label: 'GPT-4', provider: 'openai' },
        'gpt-4-turbo': { id: 'gpt-4-turbo', label: 'GPT-4 Turbo', provider: 'openai' },
        'gpt-3.5-turbo': { id: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo', provider: 'openai' },
        'o1': { id: 'o1', label: 'o1', provider: 'openai' },
        'o1-mini': { id: 'o1-mini', label: 'o1 Mini', provider: 'openai' },
        'o1-preview': { id: 'o1-preview', label: 'o1 Preview', provider: 'openai' },
        'claude-3.5-sonnet': { id: 'claude-3.5-sonnet', label: 'Claude 3.5 Sonnet', provider: 'openai' },

        // OpenAI - Scraped Proxied (openai- prefixes)
        'openai-gpt-4o': { id: 'openai-gpt-4o', label: 'GPT-4o (Alt)', provider: 'openai' },
        'openai-gpt-3.5-turbo': { id: 'openai-gpt-3.5-turbo', label: 'GPT-3.5 Turbo (Alt)', provider: 'openai' },
        'openai-o1-mini': { id: 'openai-o1-mini', label: 'o1 Mini (Alt)', provider: 'openai' },

        // OpenAI - Codex & GPT-5 (Scraped)
        'gpt-5.2-codex': { id: 'gpt-5.2-codex', label: 'GPT-5.2 Codex', provider: 'openai' },
        'gpt-5.1-codex-max': { id: 'gpt-5.1-codex-max', label: 'GPT-5.1 Codex Max', provider: 'openai' },
        'gpt-5.1-codex-mini': { id: 'gpt-5.1-codex-mini', label: 'GPT-5.1 Codex Mini', provider: 'openai' },
        'gpt-5.2': { id: 'gpt-5.2', label: 'GPT-5.2', provider: 'openai' },
        'gpt-5.1': { id: 'gpt-5.1', label: 'GPT-5.1', provider: 'openai' },
        'gpt-5.1-codex': { id: 'gpt-5.1-codex', label: 'GPT-5.1 Codex', provider: 'openai' },
        'gpt-5-codex': { id: 'gpt-5-codex', label: 'GPT-5 Codex', provider: 'openai' },
        'gpt-5-codex-mini': { id: 'gpt-5-codex-mini', label: 'GPT-5 Codex Mini', provider: 'openai' },
        'gpt-5': { id: 'gpt-5', label: 'GPT-5', provider: 'openai' },

        // OpenAI - Research
        'gpt-realtime': { id: 'gpt-realtime', label: 'GPT Realtime', provider: 'openai' },
        'gpt-audio': { id: 'gpt-audio', label: 'GPT Audio', provider: 'openai' },
        'o3-deep-research': { id: 'o3-deep-research', label: 'o3 Deep Research', provider: 'openai' },
        'o4-mini-deep-research': { id: 'o4-mini-deep-research', label: 'o4 Mini Deep Research', provider: 'openai' },
    },
    'gemini': {
        // Pure Google Gemini Models
        'gemini-2.5-pro': { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', provider: 'gemini' },
        'gemini-2.5-flash': { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', provider: 'gemini' },
        'gemini-2.5-flash-lite': { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite', provider: 'gemini' },
        'gemini-3-pro-preview': { id: 'gemini-3-pro-preview', label: 'Gemini 3 Pro Preview', provider: 'gemini' },
        'gemini-3-flash-preview': { id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash Preview', provider: 'gemini' },
        'gemini-1.5-pro': { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro', provider: 'gemini' },
        'gemini-1.5-flash': { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash', provider: 'gemini' },
    },
    'antigravity': {
        // Antigravity Specific / Hybrids
        'gemini-claude-sonnet-4-5': { id: 'gemini-claude-sonnet-4-5', label: 'Gemini Claude Sonnet 4.5', provider: 'antigravity' },
        'gemini-claude-sonnet-4-5-thinking': { id: 'gemini-claude-sonnet-4-5-thinking', label: 'Gemini Claude Sonnet 4.5 (Thinking)', provider: 'antigravity' },
        'gemini-claude-opus-4-5-thinking': { id: 'gemini-claude-opus-4-5-thinking', label: 'Gemini Claude Opus 4.5 (Thinking)', provider: 'antigravity' },
        'claude-sonnet-4-5': { id: 'claude-sonnet-4-5', label: 'Claude 4.5 Sonnet', provider: 'antigravity' },
        'claude-sonnet-4-5-thinking': { id: 'claude-sonnet-4-5-thinking', label: 'Claude 4.5 Sonnet (Thinking)', provider: 'antigravity' },
        'claude-opus-4-5-thinking': { id: 'claude-opus-4-5-thinking', label: 'Claude 4.5 Opus (Thinking)', provider: 'antigravity' },

        // Antigravity Aliases / Experimental
        'gemini-3-flash': { id: 'gemini-3-flash', label: 'Gemini 3 Flash', provider: 'antigravity' },
        'gemini-3-pro-high': { id: 'gemini-3-pro-high', label: 'Gemini 3 Pro High', provider: 'antigravity' },
        'gemini-3-pro-low': { id: 'gemini-3-pro-low', label: 'Gemini 3 Pro Low', provider: 'antigravity' },
        'gemini-3-pro-image-preview': { id: 'gemini-3-pro-image-preview', label: 'Gemini 3 Pro Image', provider: 'antigravity' },
        'gemini-3-pro-image': { id: 'gemini-3-pro-image', label: 'Gemini 3 Pro Image', provider: 'antigravity' },
        'gemini-2.5-flash-thinking': { id: 'gemini-2.5-flash-thinking', label: 'Gemini 2.5 Flash Thinking', provider: 'antigravity' },
        'gemini-2.5-computer-use-preview-10-2025': { id: 'gemini-2.5-computer-use-preview-10-2025', label: 'Gemini 2.5 Computer Use', provider: 'antigravity' },
        'rev19-uic3-1p': { id: 'rev19-uic3-1p', label: 'Gemini 2.5 Computer Use (UI)', provider: 'antigravity' },
    },
    'anthropic': {
        // Pure Anthropic (if any)
        'claude-3-5-sonnet-20240620': { id: 'claude-3-5-sonnet-20240620', label: 'Claude 3.5 Sonnet', provider: 'anthropic' },
        'claude-3-opus-20240229': { id: 'claude-3-opus-20240229', label: 'Claude 3 Opus', provider: 'anthropic' },
        'claude-3-sonnet-20240229': { id: 'claude-3-sonnet-20240229', label: 'Claude 3 Sonnet', provider: 'anthropic' },
        'claude-3-haiku-20240307': { id: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku', provider: 'anthropic' },
    },
    'custom': {
        // OSS / Other
        'gpt-oss-120b-medium': { id: 'gpt-oss-120b-medium', label: 'GPT OSS 120B Medium', provider: 'custom' },
        'gpt-oss-120b': { id: 'gpt-oss-120b', label: 'GPT OSS 120B', provider: 'custom' },
        'gpt-oss-20b': { id: 'gpt-oss-20b', label: 'GPT OSS 20B', provider: 'custom' },
    }
};

/**
 * Categorizes a raw model ID into a structured format.
 */
export function categorizeModel(modelId: string): ModelDefinition {
    // 1. Check EXACT match in definitions
    // Order matters: Antigravity > OpenAI > Copilot common ones... 
    // But since we iterate Object.values, it's safer to have unique IDs or explicit checks.

    // We'll flatten the map for quick lookup
    const allKnown = Object.values(KNOWN_DEFINITIONS).reduce((acc, current) => ({ ...acc, ...current }), {});
    if (allKnown[modelId]) {
        return allKnown[modelId];
    }

    // 2. Prefix / Pattern Matching
    const lower = modelId.toLowerCase();

    if (lower.startsWith('openai-')) {
        return { id: modelId, label: formatLabel(modelId.replace('openai-', '')), provider: 'openai' };
    }
    if (lower.startsWith('copilot-')) {
        return { id: modelId, label: formatLabel(modelId.replace('copilot-', '')), provider: 'copilot' };
    }
    if (lower.startsWith('gemini-') || lower.startsWith('antigravity-')) {
        return { id: modelId, label: formatLabel(modelId), provider: 'antigravity' };
    }
    if (lower.startsWith('claude-')) {
        return { id: modelId, label: formatLabel(modelId), provider: 'anthropic' };
    }

    // 3. Heuristics
    if (lower.includes('gpt') || lower.includes('codex') || lower.startsWith('o1')) {
        return { id: modelId, label: formatLabel(modelId), provider: 'copilot' };
    }

    return { id: modelId, label: modelId, provider: 'custom' };
}

function formatLabel(slug: string): string {
    return slug
        .split(/[-_]/)
        .map(word => {
            if (['gpt', 'llm', 'ai'].includes(word.toLowerCase())) return word.toUpperCase();
            if (/^\d/.test(word)) return word;
            return word.charAt(0).toUpperCase() + word.slice(1);
        })
        .join(' ');
}
