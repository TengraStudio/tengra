import React, { Suspense } from 'react';

import { GalleryView } from '@/components/shared/GalleryView';
import type { GroupedModels, ModelInfo } from '@/types';

import { SettingsSharedProps } from '../types';

const AboutTab = React.lazy(() => import('@/features/settings/components/AboutTab').then(m => ({ default: m.AboutTab })));
const AccountsTab = React.lazy(() => import('@/features/settings/components/AccountsTab').then(m => ({ default: m.AccountsTab })));
const AdvancedTab = React.lazy(() => import('@/features/settings/components/AdvancedTab').then(m => ({ default: m.AdvancedTab })));
const AppearanceTab = React.lazy(() => import('@/features/settings/components/AppearanceTab').then(m => ({ default: m.AppearanceTab })));
const DeveloperTab = React.lazy(() => import('@/features/settings/components/DeveloperTab').then(m => ({ default: m.DeveloperTab })));
const GeneralTab = React.lazy(() => import('@/features/settings/components/GeneralTab').then(m => ({ default: m.GeneralTab })));
const ImageSettingsTab = React.lazy(() => import('@/features/settings/components/ImageSettingsTab').then(m => ({ default: m.ImageSettingsTab })));
const MCPSettingsTab = React.lazy(() => import('@/features/settings/components/MCPSettingsTab').then(m => ({ default: m.MCPSettingsTab })));
const ModelsTab = React.lazy(() => import('@/features/settings/components/ModelsTab').then(m => ({ default: m.ModelsTab })));
const ModelUsageLimitsTab = React.lazy(() => import('@/features/settings/components/ModelUsageLimitsTab').then(m => ({ default: m.ModelUsageLimitsTab })));
const PersonasTab = React.lazy(() => import('@/features/settings/components/PersonasTab').then(m => ({ default: m.PersonasTab })));
const SpeechTab = React.lazy(() => import('@/features/settings/components/SpeechTab').then(m => ({ default: m.SpeechTab })));
const StatisticsTab = React.lazy(() => import('@/features/settings/components/StatisticsTab').then(m => ({ default: m.StatisticsTab })));
const VoiceSettingsTab = React.lazy(() => import('@/features/settings/components/VoiceSettingsTab').then(m => ({ default: m.VoiceSettingsTab })));

interface SettingsTabContentProps {
    activeTab: string
    sharedProps: SettingsSharedProps
    installedModels: ModelInfo[]
    proxyModels?: ModelInfo[]
    onRefreshModels: (bypassCache?: boolean) => void
    handleFactoryReset: () => void | Promise<void>
    groupedModels?: GroupedModels
}

export const SettingsTabContent: React.FC<SettingsTabContentProps> = ({
    activeTab,
    sharedProps,
    installedModels,
    proxyModels,
    onRefreshModels,
    handleFactoryReset,
    groupedModels
}) => {
    const tabMap: Record<string, React.ReactNode> = {
        general: <GeneralTab {...sharedProps} />,
        accounts: <AccountsTab {...sharedProps} />,
        appearance: <AppearanceTab {...sharedProps} />,
        models: (
            <ModelsTab
                {...sharedProps}
                installedModels={installedModels}
                proxyModels={proxyModels}
                onRefreshModels={onRefreshModels}
            />
        ),
        statistics: <StatisticsTab {...sharedProps} />,
        personas: <PersonasTab {...sharedProps} />,
        speech: <SpeechTab {...sharedProps} />,
        developer: <DeveloperTab {...sharedProps} />,
        advanced: (
            <AdvancedTab
                {...sharedProps}
                installedModels={installedModels}
                proxyModels={proxyModels}
            />
        ),
        about: <AboutTab {...sharedProps} onReset={() => { void handleFactoryReset(); }} />,
        'usage-limits': (
            <ModelUsageLimitsTab
                {...sharedProps}
                groupedModels={groupedModels}
            />
        ),
        'mcp-servers': <MCPSettingsTab />,
        'mcp-marketplace': <MCPSettingsTab />,
        images: <ImageSettingsTab {...sharedProps} />,
        gallery: (
            <div className="h-[75vh] min-h-[500px] border border-white/5 rounded-2xl overflow-hidden bg-black/20">
                <GalleryView language={sharedProps.settings?.general.language ?? 'tr'} />
            </div>
        ),
        voice: <VoiceSettingsTab {...sharedProps} />
    };

    return <Suspense fallback={<div className="animate-pulse p-6 text-muted-foreground">Loading...</div>}>{tabMap[activeTab] ?? null}</Suspense>;
};
