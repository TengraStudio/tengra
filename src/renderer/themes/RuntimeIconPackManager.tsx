/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import React, { useEffect } from 'react';

import { useSettings } from '@/context/SettingsContext';
import { useMarketplaceStore } from '@/store/marketplace.store';
import { appLogger } from '@/utils/renderer-logger';

const ICON_PACK_VARIABLE_PREFIX = '--icon-';

function clearIconVariables(root: HTMLElement): void {
    for (const propertyName of Array.from(root.style)) {
        if (propertyName.startsWith(ICON_PACK_VARIABLE_PREFIX)) {
            root.style.removeProperty(propertyName);
        }
    }
}

export const RuntimeIconPackManager: React.FC = () => {
    const { settings } = useSettings();
    const registry = useMarketplaceStore(state => state.registry);
    const selectedIconPackId = settings?.general.workspaceIconPack;

    useEffect(() => {
        const root = document.documentElement;
        clearIconVariables(root);
        root.removeAttribute('data-icon-pack');

        if (!selectedIconPackId || !registry?.iconPacks?.length) {
            return;
        }

        const selectedPack = registry.iconPacks.find(item => item.id === selectedIconPackId);
        if (!selectedPack) {
            return;
        }

        root.setAttribute('data-icon-pack', selectedPack.id);
        const iconVariables = selectedPack.iconVariables ?? {};
        for (const [key, value] of Object.entries(iconVariables)) {
            const normalizedKey = key.startsWith(ICON_PACK_VARIABLE_PREFIX)
                ? key
                : `${ICON_PACK_VARIABLE_PREFIX}${key}`;
            root.style.setProperty(normalizedKey, value);
        }
    }, [registry?.iconPacks, selectedIconPackId]);

    useEffect(() => {
        if (!selectedIconPackId) {
            return;
        }
        appLogger.info('RuntimeIconPackManager', `Applying icon pack: ${selectedIconPackId}`);
    }, [selectedIconPackId]);

    return null;
};

