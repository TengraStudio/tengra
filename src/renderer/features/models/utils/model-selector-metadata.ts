/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import type { ModelListItem } from '@renderer/features/models/types';

import type { ModelInfo } from '@/types';

export type SelectorChatMode = 'instant' | 'thinking' | 'agent';

interface ModelLifecycleMeta {
    lifecycle: 'active' | 'deprecated' | 'retired';
    replacementModelId?: string;
    sunsetDate?: string;
}

const REPLACEMENT_REGEX = /replacement:\s*([a-z0-9._-]+)/i;
const DATE_REGEX = /(\d{4}-\d{2}-\d{2})/;

export function getModelLifecycleMeta(model: Pick<ModelInfo, 'description'>): ModelLifecycleMeta {
    const description = (model.description ?? '').toString();
    const upper = description.toUpperCase();
    if (!upper.includes('DEPRECATED')) {
        return { lifecycle: 'active' };
    }
    const lifecycle: 'deprecated' | 'retired' = upper.includes('RETIRED') ? 'retired' : 'deprecated';
    const replacementMatch = description.match(REPLACEMENT_REGEX);
    const dateMatch = description.match(DATE_REGEX);
    return {
        lifecycle,
        replacementModelId: replacementMatch?.[1],
        sunsetDate: dateMatch?.[1],
    };
}

export function scoreModelForMode(model: ModelListItem, mode: SelectorChatMode): number {
    let score = 0;
    if (model.disabled) {
        return -1000;
    }
    if (model.lifecycle === 'retired') {
        score -= 400;
    } else if (model.lifecycle === 'deprecated') {
        score -= 160;
    }

    const contextWindow = model.contextWindow ?? 0;
    if (mode === 'instant') {
        score += model.isLocal ? 60 : 20;
        score += model.isFree ? 20 : 0;
        score += model.supportsReasoning ? -10 : 18;
        score += contextWindow > 0 && contextWindow < 65536 ? 10 : 0;
        return score;
    }
    if (mode === 'thinking') {
        score += model.supportsReasoning ? 60 : -30;
        score += contextWindow >= 128000 ? 40 : contextWindow >= 64000 ? 24 : 4;
        score += model.isLocal ? -8 : 0;
        return score;
    }
    score += model.supportsReasoning ? 35 : 10;
    score += contextWindow >= 128000 ? 55 : contextWindow >= 64000 ? 24 : 6;
    score += model.isFree ? 4 : 0;
    return score;
}
