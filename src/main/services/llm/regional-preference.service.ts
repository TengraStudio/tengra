import { ModelProviderInfo } from '@main/services/llm/model-registry.service';

/**
 * Maps locales to model ID patterns that should be prioritized.
 * Patterns are case-insensitive.
 */
const REGIONAL_PREFERENCES: Record<string, RegExp[]> = {
    // Chinese: Qwen, DeepSeek, Yi are strong local models
    zh: [/qwen/i, /deepseek/i, /yi-/i, /01-ai/i],
    // Japanese: Command R, GPT-4 (good multilingual), Claude 3 (good nuance)
    ja: [/command-r/i, /gpt-4/i, /claude-3/i, /karakuri/i],
    // French: Mistral (French company), LightOn, Mixtral
    fr: [/mistral/i, /mixtral/i, /lighton/i, /croissant/i],
    // German: Mistral, Aleph Alpha (though mostly via API/other), DiscoLM
    de: [/mistral/i, /aleph/i, /discolm/i, /leo-/i],
    // Arabic: Jais, AceGPT
    ar: [/jais/i, /acegpt/i, /allam/i],
    // Spanish: various, but Mistral/Llama usually good. No strong specific "Spanish-native" widely known open weights dominant yet, but keeping structure.
    es: [],
};

/**
 * Service to adjust model ranking based on user locale.
 */
export class RegionalPreferenceService {
    /**
     * Re-sorts the models array to boost models preferred for the given locale.
     * Preferred models appear at the top, maintaining their relative order.
     * Non-preferred models follow, maintaining their relative order.
     */
    static applyPreferences(models: ModelProviderInfo[], locale: string): ModelProviderInfo[] {
        // Normalize locale (e.g., 'zh-CN' -> 'zh')
        const baseLocale = locale.split('-')[0].toLowerCase();
        const patterns = REGIONAL_PREFERENCES[baseLocale];

        if (!patterns || patterns.length === 0) {
            return models;
        }

        const preferred: ModelProviderInfo[] = [];
        const others: ModelProviderInfo[] = [];

        for (const model of models) {
            const isPreferred = patterns.some((p) => p.test(model.id) || p.test(model.name));
            if (isPreferred) {
                preferred.push(model);
            } else {
                others.push(model);
            }
        }

        return [...preferred, ...others];
    }
}
