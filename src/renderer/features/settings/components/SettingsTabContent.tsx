import React from 'react';

import { GalleryView } from '@/components/shared/GalleryView';
import {
    AboutTab,
    AccountsTab,
    AdvancedTab,
    AppearanceTab,
    DeveloperTab,
    GeneralTab,
    ImageSettingsTab,
    MCPSettingsTab,
    ModelsTab,
    ModelUsageLimitsTab,
    PersonasTab,
    SpeechTab,
    StatisticsTab,
    VoiceSettingsTab
} from '@/features/settings/components';
import type { GroupedModels, ModelInfo } from '@/types';

import { SettingsSharedProps } from '../types';

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

    return <>{tabMap[activeTab] ?? null}</>;
};
