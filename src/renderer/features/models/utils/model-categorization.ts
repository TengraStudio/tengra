
export type ModelProvider = 'copilot' | 'openai' | 'anthropic' | 'ollama' | 'antigravity' | 'custom';

const VALID_PROVIDERS: Set<string> = new Set(['copilot', 'openai', 'anthropic', 'ollama', 'antigravity']);

export interface ModelDefinition {
    id: string;
    label: string;
    provider: ModelProvider;
    family?: string;
    type?: 'chat' | 'image' | 'video';
}

/**
 * Pure dynamic categorization. 
 * STRICTLY respects the providerHint if it's a known provider.
 */
export function categorizeModel(modelId: string, providerHint?: string): ModelDefinition {
    const lower = modelId.toLowerCase();

    const hint = providerHint?.toLowerCase();

    // Model Type Detection
    let type: 'chat' | 'image' | 'video' = 'chat';
    if (lower.includes('image') || lower.includes('imagen') || lower.includes('dalle') || lower.includes('stable-diffusion') || lower.includes('flux')) {
        type = 'image';
    } else if (lower.includes('video') || lower.includes('sora') || lower.includes('kling')) {
        type = 'video';
    }

    // STRICT: If hint is a known provider, use it directly. No heuristics.
    if (hint && VALID_PROVIDERS.has(hint)) {
        return {
            id: modelId,
            label: formatLabel(modelId),
            provider: hint as ModelProvider,
            type
        };
    }

    // Fallback Heuristics (only if no valid hint)
    let provider: ModelProvider = 'custom';
    if (lower.startsWith('copilot-') || lower.startsWith('github-')) provider = 'copilot';

    else if (lower.startsWith('claude-')) provider = 'anthropic';
    else if (lower.includes('gpt-') || lower.startsWith('o1')) provider = 'openai';

    return {
        id: modelId,
        label: formatLabel(modelId),
        provider,
        type
    };
}

function formatLabel(slug: string): string {
    const label = slug.replace(/^(github-|copilot-|openai-|codex-|antigravity-|ollama-)/i, '');
    return label
        .split(/[-_]/)
        .map(word => {
            const low = word.toLowerCase();
            if (['gpt', 'llm', 'ai', 'o1'].includes(low)) return word.toUpperCase();
            if (/^\d/.test(word)) return word;
            return word.charAt(0).toUpperCase() + word.slice(1);
        })
        .join(' ');
}
