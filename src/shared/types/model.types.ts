import type { JsonValue } from './common';
import type { AntigravityAiCreditsInfo } from './quota';

export interface ModelInfo {
    id?: string;
    name?: string;
    provider?: string;
    providerCategory?: string;
    sourceProvider?: string;
    quotaInfo?: {
        remainingQuota?: number;
        totalQuota?: number;
        resetTime?: string;
        remainingFraction?: number;
        aiCredits?: AntigravityAiCreditsInfo;
    };
    percentage?: number;
    reset?: string;
    label?: string;
    contextWindow?: number;
    pricing?: {
        input?: number;
        output?: number;
    };
    thinkingLevels?: string[];
    description?: string;
    [key: string]: JsonValue | undefined;
}

export interface GroupedModels {
    [provider: string]: {
        label: string;
        models: ModelInfo[];
    }
}
