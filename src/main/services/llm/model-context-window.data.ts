import type { ModelProviderInfo } from '@main/services/llm/model-registry.service';

const EXACT_CONTEXT_WINDOWS: Readonly<Record<string, number>> = {
    // OpenAI / Codex
    'gpt-5': 400000,
    'gpt-5-codex': 400000,
    'gpt-5-codex-mini': 400000,
    'gpt-5.1': 400000,
    'gpt-5.1-codex': 400000,
    'gpt-5.1-codex-mini': 400000,
    'gpt-5.1-codex-max': 400000,
    'gpt-5.2': 400000,
    'gpt-5.2-codex': 400000,
    'gpt-5.2-pro': 400000,
    'gpt-5-pro': 400000,
    'gpt-4.1': 1047576,
    'gpt-4.1-mini': 1047576,
    'gpt-4o': 128000,
    'gpt-4o-mini': 128000,
    'o1': 200000,
    'o1-mini': 200000,
    'o1-pro': 200000,
    'o3': 200000,
    'o3-mini': 200000,
    'o3-pro': 200000,

    // Anthropic Claude family (current docs table is 200K default)
    'claude-3-opus-20240229': 200000,
    'claude-3-haiku-20240307': 200000,
    'claude-3-5-haiku-20241022': 200000,
    'claude-3-5-sonnet-20241022': 200000,
    'claude-3-7-sonnet-20250219': 200000,
    'claude-sonnet-4-20250514': 200000,
    'claude-opus-4-20250514': 200000,
    'claude-opus-4-1-20250805': 200000,

    // Gemini official model page
    'gemini-2.5-pro': 1048576,
};

const CONTEXT_PATTERNS: ReadonlyArray<{ pattern: RegExp; size: number }> = [
    // OpenAI
    { pattern: /^gpt-5/i, size: 400000 },
    { pattern: /^gpt-4\.1/i, size: 1047576 },
    { pattern: /^gpt-4o/i, size: 128000 },
    { pattern: /^o[134]\b/i, size: 200000 },

    // Claude
    { pattern: /^claude/i, size: 200000 },

    // Gemini
    { pattern: /^gemini-2\.5-pro/i, size: 1048576 },
    { pattern: /^gemini-(2\.5|3)/i, size: 1048576 },

    // Llama families
    { pattern: /llama-3\.1|llama-3\.2|llama-3\.3|llama-4/i, size: 128000 },
    { pattern: /llama3-8b|llama3-70b/i, size: 8192 },
    { pattern: /llama2|llama-2/i, size: 4096 },

    // Qwen / DeepSeek / GLM / Mistral defaults for hosted variants in this app
    { pattern: /qwen2\.5|qwen\/qwen2\.5|qwen3|qwq-32b/i, size: 32768 },
    { pattern: /deepseek-r1|deepseek-v3/i, size: 32768 },
    { pattern: /glm[-_.]?4\.7|chatglm/i, size: 32768 },
    { pattern: /mixtral-8x22b|mistral-large|codestral/i, size: 32768 },

    // Retrieval/embedding/reranker models
    { pattern: /embed|embedding|rerank|bge|arctic-embed|nvclip/i, size: 8192 },

    // Vision / diffusion style models in NVIDIA catalog
    { pattern: /stable-diffusion|flux|video-diffusion|vision|paligemma|vila/i, size: 8192 },
];

function parseContextFromDescription(description: string | undefined): number | undefined {
    if (!description) {
        return undefined;
    }
    const contextMatch = description.match(/context(?:\s+length|\s+window)?[^0-9]{0,16}(\d{1,3})(?:\s?K|\s?000)/i);
    if (!contextMatch) {
        return undefined;
    }
    const raw = Number(contextMatch[1]);
    if (!Number.isFinite(raw) || raw <= 0) {
        return undefined;
    }
    return raw >= 1000 ? raw : raw * 1000;
}

export function resolveContextWindowForModel(model: ModelProviderInfo): number | undefined {
    if (model.contextWindow && model.contextWindow > 0) {
        return model.contextWindow;
    }

    const id = model.id.toLowerCase().trim();
    const exact = EXACT_CONTEXT_WINDOWS[id];
    if (exact) {
        return exact;
    }

    const fromDescription = parseContextFromDescription(model.description);
    if (fromDescription) {
        return fromDescription;
    }

    for (const entry of CONTEXT_PATTERNS) {
        if (entry.pattern.test(id)) {
            return entry.size;
        }
    }

    return undefined;
}
