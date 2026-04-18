/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import React, { Suspense } from 'react';

import { ErrorBoundary } from '@renderer/components/shared/ErrorBoundary';
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
const MemoryInspector = React.lazy(() => import('@/features/memory/components/MemoryInspector').then(m => ({ default: m.MemoryInspector })));
const ModelUsageLimitsTab = React.lazy(() => import('@/features/settings/components/ModelUsageLimitsTab').then(m => ({ default: m.ModelUsageLimitsTab })));
const QuotasTab = React.lazy(() => import('@/features/settings/components/QuotasTab').then(m => ({ default: m.QuotasTab })));
const PersonasTab = React.lazy(() => import('@/features/settings/components/PersonasTab').then(m => ({ default: m.PersonasTab })));
const SpeechTab = React.lazy(() => import('@/features/settings/components/SpeechTab').then(m => ({ default: m.SpeechTab })));
const StatisticsTab = React.lazy(() => import('@/features/settings/components/StatisticsTab').then(m => ({ default: m.StatisticsTab })));
const SystemTab = React.lazy(() => import('@/features/settings/components/SystemTab').then(m => ({ default: m.SystemTab })));
const WorkspaceTab = React.lazy(() => import('@/features/settings/components/WorkspaceTab').then(m => ({ default: m.WorkspaceTab })));
const SocialMediaTab = React.lazy(() => import('@/features/settings/components/SocialMediaTab').then(m => ({ default: m.SocialMediaTab })));

// Extensions Category Tabs
const ExtensionPluginsTab = React.lazy(() => import('@/features/settings/components/ExtensionPluginsTab').then(m => ({ default: m.ExtensionPluginsTab })));
const MCPServersTab = React.lazy(() => import('@/features/settings/components/MCPServersTab').then(m => ({ default: m.MCPServersTab })));
const SkillsTab = React.lazy(() => import('@/features/settings/components/SkillsTab').then(m => ({ default: m.SkillsTab })));

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
        case 'memory': return <MemoryInspector />;
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
        
        // Extension Category
        case 'extensions-plugins': return <ExtensionPluginsTab {...sharedProps} />;
        case 'extensions-mcp': return (
            <div className="rounded-lg border border-border/40 bg-card/30 p-1">
                <MCPServersTab />
            </div>
        );
        case 'extensions-skills': return <SkillsTab {...sharedProps} />;
        
        // Legacy/Fallback cases
        case 'skills': return <SkillsTab {...sharedProps} />;
        case 'extensions': return <ExtensionPluginsTab {...sharedProps} />;
        
        default: return null;
    }
};

export const SettingsTabContent: React.FC<SettingsTabContentProps> = (props) => {
    const { sharedProps } = props;
    return (
        <ErrorBoundary>
            <Suspense fallback={<div className="animate-pulse p-6 text-muted-foreground">{sharedProps.t('common.loading')}</div>}>
                <SettingsTabRenderer {...props} />
            </Suspense>
        </ErrorBoundary>
    );
};
