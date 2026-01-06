
export type ModelProvider = 'copilot' | 'openai' | 'anthropic' | 'gemini' | 'ollama' | 'antigravity' | 'custom';

export interface ModelDefinition {
    id: string;
    label: string;
    provider: ModelProvider;
    family?: string;
    type?: 'chat' | 'image' | 'video';
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

        // GitHub Copilot - Extended / Experimental
        'gpt-5': { id: 'gpt-5', label: 'GPT-5 (Copilot)', provider: 'copilot' },
        'gpt-5-preview': { id: 'gpt-5-preview', label: 'GPT-5 (Preview) (Copilot)', provider: 'copilot' },
        'gpt-5.1': { id: 'gpt-5.1', label: 'GPT-5.1 (Copilot)', provider: 'copilot' },
        'gpt-5-codex': { id: 'gpt-5-codex', label: 'GPT-5 Codex (Codex)', provider: 'copilot' },
        'gpt-5.1-codex': { id: 'gpt-5.1-codex', label: 'GPT-5.1 Codex (Codex)', provider: 'copilot' },
        'gpt-5-codex-mini': { id: 'gpt-5-codex-mini', label: 'GPT-5 Codex Mini (Codex)', provider: 'copilot' },
        'gpt-5.1-codex-mini': { id: 'gpt-5.1-codex-mini', label: 'GPT-5.1 Codex Mini (Codex)', provider: 'copilot' },
        'o1': { id: 'o1', label: 'o1 (Copilot)', provider: 'copilot' },
        'o1-preview': { id: 'o1-preview', label: 'o1 Preview (Copilot)', provider: 'copilot' },
        'o1-mini': { id: 'o1-mini', label: 'o1 Mini (Copilot)', provider: 'copilot' },
        'gpt-4.1': { id: 'gpt-4.1', label: 'GPT-4.1 (Copilot)', provider: 'copilot' },
        'claude-sonnet-4': { id: 'claude-sonnet-4', label: 'Claude 4 Sonnet (Copilot)', provider: 'copilot' },
        'raptor-mini': { id: 'raptor-mini', label: 'Raptor Mini (Copilot)', provider: 'copilot' },
    },
    'openai': {
        // OpenAI - Standard
        'gpt-4o': { id: 'gpt-4o', label: 'GPT-4o (Codex)', provider: 'openai' },
        'gpt-4': { id: 'gpt-4', label: 'GPT-4 (Codex)', provider: 'openai' },
        'gpt-4-turbo': { id: 'gpt-4-turbo', label: 'GPT-4 Turbo (Codex)', provider: 'openai' },
        'gpt-3.5-turbo': { id: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo (Codex)', provider: 'openai' },
        'o1': { id: 'o1', label: 'o1 (Codex)', provider: 'openai' },
        'o1-mini': { id: 'o1-mini', label: 'o1 Mini (Codex)', provider: 'openai' },
        'o1-preview': { id: 'o1-preview', label: 'o1 Preview (Codex)', provider: 'openai' },

        // OpenAI - Scraped Proxied (openai- prefixes)
        'openai-gpt-4o': { id: 'openai-gpt-4o', label: 'GPT-4o (Alt) (Codex)', provider: 'openai' },
        'openai-gpt-3.5-turbo': { id: 'openai-gpt-3.5-turbo', label: 'GPT-3.5 Turbo (Alt) (Codex)', provider: 'openai' },
        'openai-o1-mini': { id: 'openai-o1-mini', label: 'o1 Mini (Alt) (Codex)', provider: 'openai' },

        // OpenAI - Codex & GPT-5 (Scraped)
        'gpt-5.2-codex': { id: 'gpt-5.2-codex', label: 'GPT-5.2 Codex (Codex)', provider: 'openai' },
        'gpt-5.1-codex-max': { id: 'gpt-5.1-codex-max', label: 'GPT-5.1 Codex Max (Codex)', provider: 'openai' },
        'gpt-5.1-codex-mini': { id: 'gpt-5.1-codex-mini', label: 'GPT-5.1 Codex Mini (Codex)', provider: 'openai' },
        'gpt-5.2': { id: 'gpt-5.2', label: 'GPT-5.2 (Codex)', provider: 'openai' },
        'gpt-5.1': { id: 'gpt-5.1', label: 'GPT-5.1 (Codex)', provider: 'openai' },
        'gpt-5.1-codex': { id: 'gpt-5.1-codex', label: 'GPT-5.1 Codex (Codex)', provider: 'openai' },
        'gpt-5-codex': { id: 'gpt-5-codex', label: 'GPT-5 Codex (Codex)', provider: 'openai' },
        'gpt-5-codex-mini': { id: 'gpt-5-codex-mini', label: 'GPT-5 Codex Mini (Codex)', provider: 'openai' },
        'gpt-5': { id: 'gpt-5', label: 'GPT-5 (Codex)', provider: 'openai' },

        // OpenAI - Research
        'gpt-realtime': { id: 'gpt-realtime', label: 'GPT Realtime (Codex)', provider: 'openai' },
        'gpt-audio': { id: 'gpt-audio', label: 'GPT Audio (Codex)', provider: 'openai' },
        'o3-deep-research': { id: 'o3-deep-research', label: 'o3 Deep Research (Codex)', provider: 'openai' },
        'o4-mini-deep-research': { id: 'o4-mini-deep-research', label: 'o4 Mini Deep Research (Codex)', provider: 'openai' },
    },
    'gemini': {
        // Pure Google Gemini Models
        'gemini-2.5-pro': { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (Gemini)', provider: 'gemini' },
        'gemini-2.5-flash': { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Gemini)', provider: 'gemini' },
        'gemini-2.5-flash-lite': { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite (Gemini)', provider: 'gemini' },
        'gemini-3-pro-preview': { id: 'gemini-3-pro-preview', label: 'Gemini 3 Pro Preview (Gemini)', provider: 'gemini' },
        'gemini-3-flash-preview': { id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash Preview (Gemini)', provider: 'gemini' },
        'gemini-1.5-pro': { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro (Gemini)', provider: 'gemini' },
        'gemini-1.5-flash': { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash (Gemini)', provider: 'gemini' },
    },
    'antigravity': {
        // Antigravity Specific / Hybrids
        'gemini-claude-sonnet-4-5': { id: 'gemini-claude-sonnet-4-5', label: 'Gemini Claude Sonnet 4.5 (Antigravity)', provider: 'antigravity' },
        'gemini-claude-sonnet-4-5-thinking': { id: 'gemini-claude-sonnet-4-5-thinking', label: 'Gemini Claude Sonnet 4.5 Thinking (Antigravity)', provider: 'antigravity' },
        'gemini-claude-opus-4-5-thinking': { id: 'gemini-claude-opus-4-5-thinking', label: 'Gemini Claude Opus 4.5 Thinking (Antigravity)', provider: 'antigravity' },
        'claude-sonnet-4-5': { id: 'claude-sonnet-4-5', label: 'Claude 4.5 Sonnet (Antigravity)', provider: 'antigravity' },
        'claude-sonnet-4-5-thinking': { id: 'claude-sonnet-4-5-thinking', label: 'Claude 4.5 Sonnet Thinking (Antigravity)', provider: 'antigravity' },
        'claude-opus-4-5-thinking': { id: 'claude-opus-4-5-thinking', label: 'Claude 4.5 Opus Thinking (Antigravity)', provider: 'antigravity' },

        // Antigravity Aliases / Experimental
        'gemini-3-flash': { id: 'gemini-3-flash', label: 'Gemini 3 Flash (Antigravity)', provider: 'antigravity' },
        'gemini-3-pro-high': { id: 'gemini-3-pro-high', label: 'Gemini 3 Pro High (Antigravity)', provider: 'antigravity' },
        'gemini-3-pro-low': { id: 'gemini-3-pro-low', label: 'Gemini 3 Pro Low (Antigravity)', provider: 'antigravity' },
        'gemini-3-pro-image-preview': { id: 'gemini-3-pro-image-preview', label: 'Gemini 3 Pro Image (Antigravity)', provider: 'antigravity', type: 'image' },
        'gemini-3-pro-image': { id: 'gemini-3-pro-image', label: 'Gemini 3 Pro Image (Antigravity)', provider: 'antigravity', type: 'image' },
        'gemini-2.5-flash-image-preview': { id: 'gemini-2.5-flash-image-preview', label: 'Gemini 2.5 Flash Image (Antigravity)', provider: 'antigravity', type: 'image' },
        'gemini-2.5-flash-thinking': { id: 'gemini-2.5-flash-thinking', label: 'Gemini 2.5 Flash Thinking (Antigravity)', provider: 'antigravity' },
        'gemini-2.5-computer-use-preview-10-2025': { id: 'gemini-2.5-computer-use-preview-10-2025', label: 'Gemini 2.5 Computer Use (Antigravity)', provider: 'antigravity' },
        'rev19-uic3-1p': { id: 'rev19-uic3-1p', label: 'Gemini 2.5 Computer Use UI (Antigravity)', provider: 'antigravity' },
    },
    'anthropic': {
        // Pure Anthropic (if any)
        'claude-3-5-sonnet-20240620': { id: 'claude-3-5-sonnet-20240620', label: 'Claude 3.5 Sonnet (Anthropic)', provider: 'anthropic' },
        'claude-3-opus-20240229': { id: 'claude-3-opus-20240229', label: 'Claude 3 Opus (Anthropic)', provider: 'anthropic' },
        'claude-3-sonnet-20240229': { id: 'claude-3-sonnet-20240229', label: 'Claude 3 Sonnet (Anthropic)', provider: 'anthropic' },
        'claude-3-haiku-20240307': { id: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku (Anthropic)', provider: 'anthropic' },
    },
    'custom': {
        // OSS / Other
        'gpt-oss-120b-medium': { id: 'gpt-oss-120b-medium', label: 'GPT OSS 120B Medium (Custom)', provider: 'custom' },
        'gpt-oss-120b': { id: 'gpt-oss-120b', label: 'GPT OSS 120B (Custom)', provider: 'custom' },
        'gpt-oss-20b': { id: 'gpt-oss-20b', label: 'GPT OSS 20B (Custom)', provider: 'custom' },
    }
};

/**
 * Categorizes a raw model ID into a structured format.
 */
export function categorizeModel(modelId: string, providerHint?: string): ModelDefinition {
    const lower = modelId.toLowerCase();
    const hint = providerHint?.toLowerCase();

    // 1. Antigravity Priority
    // Any model with 'antigravity' in ID or intent should go to Antigravity category
    if (lower.includes('antigravity') || hint === 'antigravity') {
        const cleanLabel = formatLabel(modelId.replace(/antigravity/i, '').replace(/[-_]+/g, ' ').trim());
        return { id: modelId, label: cleanLabel + ' (Antigravity)', provider: 'antigravity' };
    }

    // 2. Check EXACT match in definitions with Provider Hint
    // But override provider if it matches our new rules (e.g. Codex -> OpenAI)
    let known: ModelDefinition | undefined;
    if (providerHint && KNOWN_DEFINITIONS[providerHint]?.[modelId]) {
        known = KNOWN_DEFINITIONS[providerHint][modelId];
    } else {
        const priority = ['copilot', 'openai', 'anthropic', 'gemini', 'antigravity', 'custom'];
        for (const p of priority) {
            if (KNOWN_DEFINITIONS[p]?.[modelId]) {
                known = KNOWN_DEFINITIONS[p][modelId];
                break;
            }
        }
    }

    // If known, we might need to patch the provider or label based on user rules
    if (known) {
        // Rule: Codex models go to OpenAI category
        if (known.id.toLowerCase().includes('codex')) {
            return { ...known, provider: 'openai', label: known.label.includes('(Codex)') ? known.label : known.label + ' (Codex)' };
        }
        return known;
    }

    // 3. Dynamic Categorization

    if (lower.startsWith('openai-') || hint === 'openai') {
        const idBase = lower.startsWith('openai-') ? modelId.replace('openai-', '') : modelId;
        // Codex check for OpenAI dynamic models
        if (idBase.includes('codex')) {
            return { id: modelId, label: formatLabel(idBase) + ' (Codex)', provider: 'openai' };
        }
        return { id: modelId, label: formatLabel(idBase) + ' (OpenAI)', provider: 'openai' };
    }

    if (lower.startsWith('copilot-') || hint === 'copilot') {
        const idBase = lower.startsWith('copilot-') ? modelId.replace('copilot-', '') : modelId;
        // Rule: Codex models should be categorized as OpenAI for UI
        if (lower.includes('codex')) {
            return { id: modelId, label: formatLabel(idBase) + ' (Codex)', provider: 'openai' };
        }
        return { id: modelId, label: formatLabel(idBase) + ' (Copilot)', provider: 'copilot' };
    }

    if ((lower.startsWith('gemini-') && !lower.includes('claude')) || hint === 'gemini' || hint === 'google') {
        return { id: modelId, label: formatLabel(modelId) + ' (Gemini)', provider: 'gemini' };
    }

    if (lower.startsWith('claude-') || hint === 'anthropic' || hint === 'claude') {
        return { id: modelId, label: formatLabel(modelId) + ' (Anthropic)', provider: 'anthropic' };
    }

    // 4. Heuristics
    if (lower.includes('codex')) {
        return { id: modelId, label: formatLabel(modelId) + ' (Codex)', provider: 'openai' };
    }
    if (lower.includes('gpt') || lower.startsWith('o1')) {
        // Default GPT to Copilot if no other hint
        return { id: modelId, label: formatLabel(modelId) + ' (Copilot)', provider: 'copilot' };
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
