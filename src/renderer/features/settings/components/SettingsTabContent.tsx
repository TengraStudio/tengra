import React, { Suspense } from 'react';

import { SettingsCategory } from '@/features/settings/types';
import type { GroupedModels, ModelInfo } from '@/types';

import { SettingsSharedProps } from '../types';

const AboutTab = React.lazy(() => import('@/features/settings/components/AboutTab').then(m => ({ default: m.AboutTab })));
const AccountsTab = React.lazy(() => import('@/features/settings/components/AccountsTab').then(m => ({ default: m.AccountsTab })));
const AdvancedTab = React.lazy(() => import('@/features/settings/components/AdvancedTab').then(m => ({ default: m.AdvancedTab })));
const AppearanceTab = React.lazy(() => import('@/features/settings/components/AppearanceTab').then(m => ({ default: m.AppearanceTab })));
const DeveloperTab = React.lazy(() => import('@/features/settings/components/DeveloperTab').then(m => ({ default: m.DeveloperTab })));
const EditorTab = React.lazy(() => import('@/features/settings/components/EditorTab').then(m => ({ default: m.EditorTab })));
const GeneralTab = React.lazy(() => import('@/features/settings/components/GeneralTab').then(m => ({ default: m.GeneralTab })));
const ImageSettingsTab = React.lazy(() => import('@/features/settings/components/ImageSettingsTab').then(m => ({ default: m.ImageSettingsTab })));
const ModelsTab = React.lazy(() => import('@/features/settings/components/ModelsTab').then(m => ({ default: m.ModelsTab })));
const ModelUsageLimitsTab = React.lazy(() => import('@/features/settings/components/ModelUsageLimitsTab').then(m => ({ default: m.ModelUsageLimitsTab })));
const QuotasTab = React.lazy(() => import('@/features/settings/components/QuotasTab').then(m => ({ default: m.QuotasTab })));
const PersonasTab = React.lazy(() => import('@/features/settings/components/PersonasTab').then(m => ({ default: m.PersonasTab })));
const SpeechTab = React.lazy(() => import('@/features/settings/components/SpeechTab').then(m => ({ default: m.SpeechTab })));
const StatisticsTab = React.lazy(() => import('@/features/settings/components/StatisticsTab').then(m => ({ default: m.StatisticsTab })));
const SystemTab = React.lazy(() => import('@/features/settings/components/SystemTab').then(m => ({ default: m.SystemTab })));
const WorkspaceTab = React.lazy(() => import('@/features/settings/components/WorkspaceTab').then(m => ({ default: m.WorkspaceTab })));
const SocialMediaTab = React.lazy(() => import('@/features/settings/components/SocialMediaTab').then(m => ({ default: m.SocialMediaTab })));

interface SettingsTabContentProps {
    activeTab: SettingsCategory
    sharedProps: SettingsSharedProps
    installedModels: ModelInfo[]
    proxyModels?: ModelInfo[]
    onRefreshModels: (bypassCache?: boolean) => void
    handleFactoryReset: () => void | Promise<void>
    groupedModels?: GroupedModels
}

const SettingsTabRenderer: React.FC<SettingsTabContentProps> = ({
    activeTab,
    sharedProps,
    installedModels,
    proxyModels,
    onRefreshModels,
    handleFactoryReset,
    groupedModels
}) => {
    switch (activeTab) {
        case 'general': return <GeneralTab {...sharedProps} groupedModels={groupedModels} />;
        case 'workspace': return <WorkspaceTab {...sharedProps} />;
        case 'editor': return <EditorTab {...sharedProps} />;
        case 'accounts': return <AccountsTab {...sharedProps} />;
        case 'appearance': return <AppearanceTab {...sharedProps} />;
        case 'system': return <SystemTab {...sharedProps} />;
        case 'models': return <ModelsTab {...sharedProps} installedModels={installedModels} proxyModels={proxyModels} onRefreshModels={onRefreshModels} />;
        case 'quotas': return <QuotasTab {...sharedProps} />;
        case 'statistics': return <StatisticsTab {...sharedProps} />;
        case 'personas': return <PersonasTab {...sharedProps} />;
        case 'speech': return <SpeechTab {...sharedProps} />;
        case 'developer': return <DeveloperTab {...sharedProps} />;
        case 'advanced': return <AdvancedTab {...sharedProps} installedModels={installedModels} proxyModels={proxyModels} />;
        case 'about': return <AboutTab {...sharedProps} onReset={() => { void handleFactoryReset(); }} />;
        case 'usage-limits': return <ModelUsageLimitsTab {...sharedProps} groupedModels={groupedModels} />;
        case 'images': return <ImageSettingsTab {...sharedProps} />;
        case 'social-media': return <SocialMediaTab {...sharedProps} />;
        default: return null;
    }
};

export const SettingsTabContent: React.FC<SettingsTabContentProps> = (props) => {
    const { sharedProps } = props;
    return (
        <Suspense fallback={<div className="animate-pulse p-6 text-muted-foreground">{sharedProps.t('common.loading')}</div>}>
            <SettingsTabRenderer {...props} />
        </Suspense>
    );
};
