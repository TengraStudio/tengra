import { GroupedModels, ModelInfo } from '@renderer/features/models/utils/model-fetcher';
import React, { lazy, Suspense, useCallback } from 'react';

import { LoadingState } from '@/components/ui/LoadingState';
import { SettingsCategory } from '@/features/settings/types';

const SettingsPage = lazy(() => import('@/features/settings/SettingsPage').then(m => ({ default: m.SettingsPage })));

interface SettingsViewProps {
    installedModels: ModelInfo[]
    proxyModels: ModelInfo[]
    loadModels: (bypassCache?: boolean) => void
    settingsCategory: SettingsCategory
    groupedModels?: GroupedModels | null
    searchQuery?: string
}

export const SettingsView: React.FC<SettingsViewProps> = ({
    installedModels,
    proxyModels,
    loadModels,
    settingsCategory,
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
                groupedModels={groupedModels}
                searchQuery={searchQuery}
            />
        </Suspense>
    );
};

SettingsView.displayName = 'SettingsView';
