/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import type { JsonValue } from './common';
import type { AntigravityAiCreditsInfo } from './quota';

export interface ModelInfo {
    id?: string;
    name?: string;
    provider?: string;
    providerCategory?: string;
    sourceProvider?: string;
    runtimeProvider?: string;
    fileFormat?: string;
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

