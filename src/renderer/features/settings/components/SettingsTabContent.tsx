import React, { Suspense } from 'react';

import { SettingsCategory } from '@/features/settings/types';
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
const GalleryView = React.lazy(() => import('@/components/shared/GalleryView').then(m => ({ default: m.GalleryView })));

interface SettingsTabContentProps {
    activeTab: SettingsCategory
    sharedProps: SettingsSharedProps
    installedModels: ModelInfo[]
    proxyModels?: ModelInfo[]
    onRefreshModels: (bypassCache?: boolean) => void
    handleFactoryReset: () => void | Promise<void>
    groupedModels?: GroupedModels
}

function renderSettingsTabContent({
    activeTab,
    sharedProps,
    installedModels,
    proxyModels,
    onRefreshModels,
    handleFactoryReset,
    groupedModels
}: SettingsTabContentProps): JSX.Element | null {
    switch (activeTab) {
        case 'general': return <GeneralTab {...sharedProps} />;
        case 'accounts': return <AccountsTab {...sharedProps} />;
        case 'appearance': return <AppearanceTab {...sharedProps} />;
        case 'models': return <ModelsTab {...sharedProps} installedModels={installedModels} proxyModels={proxyModels} onRefreshModels={onRefreshModels} />;
        case 'statistics': return <StatisticsTab {...sharedProps} />;
        case 'personas': return <PersonasTab {...sharedProps} />;
        case 'speech': return <SpeechTab {...sharedProps} />;
        case 'developer': return <DeveloperTab {...sharedProps} />;
        case 'advanced': return <AdvancedTab {...sharedProps} installedModels={installedModels} proxyModels={proxyModels} />;
        case 'about': return <AboutTab {...sharedProps} onReset={() => { void handleFactoryReset(); }} />;
        case 'usage-limits': return <ModelUsageLimitsTab {...sharedProps} groupedModels={groupedModels} />;
        case 'mcp-servers': return <MCPSettingsTab />;
        case 'images': return <ImageSettingsTab {...sharedProps} />;
        case 'gallery':
            return (
                <div className="h-[75vh] min-h-[500px] border border-white/5 rounded-2xl overflow-hidden bg-black/20">
                    <GalleryView language={sharedProps.settings?.general.language ?? 'tr'} />
                </div>
            );
        case 'voice': return <VoiceSettingsTab {...sharedProps} />;
        default: return null;
    }
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
    return (
        <Suspense fallback={<div className="animate-pulse p-6 text-muted-foreground">{sharedProps.t('common.loading')}</div>}>
            {renderSettingsTabContent({
                activeTab,
                sharedProps,
                installedModels,
                proxyModels,
                onRefreshModels,
                handleFactoryReset,
                groupedModels
            })}
        </Suspense>
    );
};
