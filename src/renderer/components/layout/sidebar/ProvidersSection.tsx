/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconBrain, IconCpu, IconSparkles } from '@tabler/icons-react';
import React from 'react';

import { SidebarMenuItem, SidebarSection } from '@/components/layout/sidebar-components';
import { SettingsCategory } from '@/features/settings/types';
import { Language, useTranslation } from '@/i18n';

interface ProvidersSectionProps {
    isCollapsed: boolean;
    language: string;
    onOpenSettings: (category: SettingsCategory) => void;
}

export const ProvidersSectionComponent: React.FC<ProvidersSectionProps> = ({
    isCollapsed,
    language,
    onOpenSettings,
}) => {
    const { t } = useTranslation(language as Language);

    if (isCollapsed) {
        return null;
    }

    return (
        <SidebarSection
            id="ai-providers"
            title={t('frontend.sidebar.aiProviders')}
            icon={<IconSparkles className="w-3.5 h-3.5" />}
            defaultExpanded={false}
            badge={4}
        >
            <SidebarMenuItem
                id="ollama"
                icon={<IconBrain className="w-4 h-4" />}
                label={t('frontend.sidebar.ollama')}
                description={t('frontend.sidebar.ollamaDescription')}
                onClick={() => onOpenSettings('models' as SettingsCategory)}
                status="online"
                statusLabel={t('frontend.sidebar.ollamaRunning')}
            />
            <SidebarMenuItem
                id="openai"
                icon={<IconSparkles className="w-4 h-4" />}
                label={t('frontend.sidebar.openai')}
                description={t('frontend.sidebar.openaiDescription')}
                onClick={() => onOpenSettings('models' as SettingsCategory)}
                status="online"
            />
            <SidebarMenuItem
                id="anthropic"
                icon={<IconBrain className="w-4 h-4" />}
                label={t('frontend.sidebar.anthropic')}
                description={t('frontend.sidebar.anthropicDescription')}
                onClick={() => onOpenSettings('models' as SettingsCategory)}
                status="online"
            />
            <SidebarMenuItem
                id="copilot"
                icon={<IconCpu className="w-4 h-4" />}
                label={t('frontend.sidebar.copilot')}
                description={t('frontend.sidebar.copilotDescription')}
                onClick={() => onOpenSettings('accounts' as SettingsCategory)}
                status="online"
                statusLabel={t('frontend.sidebar.copilotActive')}
            />
        </SidebarSection>
    );
};

ProvidersSectionComponent.displayName = 'ProvidersSection';

