/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

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

    const hint = normalizeProviderHint(providerHint);

    const type = detectModelType(lower);

    // Strong ID signal overrides generic OpenAI-compatible hints.
    // Some providers expose OpenAI-compatible APIs but model IDs still encode the true source.
    if (lower.includes('nvidia/') || lower.startsWith('nv-')) {
        return createDefinition(modelId, 'nvidia', type);
    }

    if (isLikelyNvidiaCatalogModel(lower)) {
        return createDefinition(modelId, 'nvidia', type);
    }

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
    // GGUF alone is not a reliable signal for Ollama.
    // Many remote/community catalogs include GGUF models that are not locally installed.
    if (lowerId.startsWith('ollama/')) {
        return 'ollama';
    }
    if (lowerId.includes('nvidia/') || lowerId.startsWith('nv-')) {
        return 'nvidia';
    }
    if (isLikelyNvidiaCatalogModel(lowerId)) {
        return 'nvidia';
    }
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
    return 'custom';
}

function normalizeProviderHint(providerHint?: string): string | undefined {
    const hint = providerHint?.trim().toLowerCase();
    if (!hint) {
        return undefined;
    }

    if (hint === 'nvidia_key' || hint === 'nim' || hint === 'nim_openai') {
        return 'nvidia';
    }

    if (hint.includes('nvidia')) {
        return 'nvidia';
    }

    return hint;
}

function isLikelyNvidiaCatalogModel(lowerId: string): boolean {
    return lowerId.startsWith('nvidia/') ||
        lowerId.startsWith('meta/') ||
        lowerId.startsWith('mistralai/') ||
        lowerId.startsWith('microsoft/') ||
        lowerId.startsWith('qwen/') ||
        lowerId.startsWith('deepseek-ai/') ||
        lowerId.startsWith('z-ai/') ||
        lowerId.includes('nemotron') ||
        lowerId.includes('chatqa');
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
