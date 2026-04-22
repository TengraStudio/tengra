/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { appLogger } from '@main/logging/logger';
import { ModelProviderInfo } from '@main/services/llm/model-registry.service';
import { ModelSelectionService } from '@main/services/llm/model-selection.service';
import { AuthService } from '@main/services/security/auth.service';

export interface BackgroundModelSelection {
    model: string;
    provider: string;
    source: 'oauth' | 'local' | 'api-key';
}

interface BackgroundModelResolverDeps {
    authService: AuthService;
    getModels: () => Promise<ModelProviderInfo[]>;
}

/**
 * Selects a cheap, low-impact model for background jobs such as memory
 * extraction. This intentionally does not reuse the user's active chat model.
 */
export class BackgroundModelResolver {
    private cachedSelection: { value: BackgroundModelSelection | null; expiresAt: number } | null = null;
    private readonly cacheTtlMs = 60_000;
    private readonly selector: ModelSelectionService;

    constructor(deps: BackgroundModelResolverDeps) {
        this.selector = new ModelSelectionService(deps);
    }

    async resolve(): Promise<BackgroundModelSelection | null> {
        if (this.cachedSelection && this.cachedSelection.expiresAt > Date.now()) {
            return this.cachedSelection.value;
        }

        const recommendation = await this.selector.recommendBackgroundModel();
        const selected = recommendation.selection;

        this.cachedSelection = {
            value: selected ? { ...selected } : null,
            expiresAt: Date.now() + this.cacheTtlMs,
        };

        if (selected) {
            appLogger.debug(
                'BackgroundModelResolver',
                `Selected background model provider=${selected.provider} model=${selected.model} source=${selected.source}; ${recommendation.reason}`
            );
        } else {
            appLogger.debug('BackgroundModelResolver', 'No usable background model found');
        }

        return selected;
    }
    // Strategy moved to ModelSelectionService.
}
