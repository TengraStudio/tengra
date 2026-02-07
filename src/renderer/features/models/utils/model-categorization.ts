
export type ModelProvider = 'copilot' | 'openai' | 'codex' | 'anthropic' | 'ollama' | 'antigravity' | 'opencode' | 'nvidia' | 'custom';

const VALID_PROVIDERS: Set<string> = new Set(['copilot', 'openai', 'codex', 'anthropic', 'ollama', 'antigravity', 'opencode', 'nvidia', 'github']);

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

    const type = detectModelType(lower);

    // STRICT: If hint is a known provider, use it directly. No heuristics.
    if (hint && VALID_PROVIDERS.has(hint)) {
        return createDefinition(modelId, hint as ModelProvider, type);
    }

    // Fallback Heuristics
    const provider = detectProvider(lower);
    return createDefinition(modelId, provider, type);
}

function detectModelType(lowerId: string): 'chat' | 'image' | 'video' {
    if (lowerId.includes('image') || lowerId.includes('imagen') || lowerId.includes('dalle') || lowerId.includes('stable-diffusion') || lowerId.includes('flux')) {
        return 'image';
    }
    if (lowerId.includes('video') || lowerId.includes('sora') || lowerId.includes('kling')) {
        return 'video';
    }
    return 'chat';
}

function detectProvider(lowerId: string): ModelProvider {
    if (lowerId.includes('codex') || lowerId.startsWith('gpt-5') || lowerId.startsWith('o1') || lowerId.startsWith('o3')) {
        return 'codex';
    }
    if (lowerId.includes('gpt-')) {
        return 'openai';
    }
    if (lowerId.startsWith('copilot-') || lowerId.startsWith('github-')) {
        return 'copilot';
    }
    if (lowerId.startsWith('claude-') || lowerId.includes('anthropic/')) {
        return 'anthropic';
    }
    if (lowerId.startsWith('opencode-')) {
        return 'opencode';
    }
    if (lowerId.includes('nvidia/')) {
        return 'nvidia';
    }
    return 'custom';
}

function createDefinition(id: string, provider: ModelProvider, type: 'chat' | 'image' | 'video'): ModelDefinition {
    return {
        id,
        label: formatLabel(id),
        provider,
        type
    };
}

function formatLabel(slug: string): string {
    let label = slug.replace(/^(github-|copilot-|openai-|codex-|antigravity-|ollama-|opencode-|nvidia-|nvidia\/|google\/|meta\/|mistralai\/|microsoft\/|deepseek-ai\/)/i, '');

    // If ID contains multiple slashes or segments, take the last part
    if (label.includes('/')) {
        const parts = label.split('/');
        label = parts[parts.length - 1] ?? label;
    }

    return label
        .split(/[-_]/)
        .map(word => {
            const low = word.toLowerCase();
            if (['gpt', 'llm', 'ai', 'o1', 'r1', 'v3'].includes(low)) { return word.toUpperCase(); }
            if (/^\d/.test(word)) { return word; }
            return word.charAt(0).toUpperCase() + word.slice(1);
        })
        .join(' ');
}
