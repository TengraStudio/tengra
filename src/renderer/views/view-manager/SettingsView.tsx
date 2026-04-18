/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import React, { lazy, Suspense, useCallback } from 'react';

import { LoadingState } from '@/components/ui/LoadingState';
import { SettingsCategory } from '@/features/settings/types';
import type { GroupedModels, ModelInfo } from '@/types';

const SettingsPage = lazy(() => import('@/features/settings/SettingsPage').then(m => ({ default: m.SettingsPage })));

interface SettingsViewProps {
    installedModels: ModelInfo[]
    proxyModels: ModelInfo[]
    loadModels: (bypassCache?: boolean) => void
    settingsCategory: SettingsCategory
    onSettingsCategoryChange?: (category: SettingsCategory) => void
    groupedModels?: GroupedModels | null
    searchQuery?: string
}

export const SettingsView: React.FC<SettingsViewProps> = ({
    installedModels,
    proxyModels,
    loadModels,
    settingsCategory,
    onSettingsCategoryChange,
    groupedModels,
    searchQuery
}) => {
    const onRefreshModels = useCallback((bypassCache?: boolean) => {
        void loadModels(bypassCache);
    }, [loadModels]);

    return (
        <Suspense fallback={<LoadingState size="md" />}>
            <SettingsPage
                installedModels={installedModels}
                proxyModels={proxyModels}
                onRefreshModels={onRefreshModels}
                activeTab={settingsCategory}
                onTabChange={onSettingsCategoryChange}
                groupedModels={groupedModels}
                searchQuery={searchQuery}
            />
        </Suspense>
    );
};

SettingsView.displayName = 'SettingsView';
