/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconContainer, IconPlug, IconTerminal } from '@tabler/icons-react';
import React from 'react';

import { SidebarMenuItem, SidebarSection } from '@/components/layout/sidebar-components';
import { AppView } from '@/hooks/useAppState';
import { Language, useTranslation } from '@/i18n';

interface ToolsSectionProps {
    isCollapsed: boolean;
    currentView: AppView;
    onChangeView: (view: AppView) => void;
    language: string;
}

export const ToolsSectionComponent: React.FC<ToolsSectionProps> = ({
    isCollapsed,
    currentView,
    onChangeView,
    language,
}) => {
    const { t } = useTranslation(language as Language); // i18n helper might need cast if types are rigid

    if (isCollapsed) {
        return null;
    }

    return (
        <SidebarSection
            id="tools"
            title={t('sidebar.tools')}
            icon={<IconPlug className="w-3.5 h-3.5" />}
            defaultExpanded={false}
            badge={3}
        >
            <SidebarMenuItem
                id="mcp"
                icon={<IconPlug className="w-4 h-4" />}
                label={t('sidebar.mcpServices')}
                description={t('sidebar.mcpDescription')}
                onClick={() => onChangeView('mcp')}
                isActive={currentView === 'mcp'}
                status="online"
                statusLabel="3/3"
            />
            <SidebarMenuItem
                id="docker"
                icon={<IconContainer className="w-4 h-4" />}
                label={t('sidebar.docker')}
                description={t('sidebar.dockerDescription')}
                onClick={() => onChangeView('docker')}
                status="idle"
            />
            <SidebarMenuItem
                id="terminal"
                icon={<IconTerminal className="w-4 h-4" />}
                label={t('sidebar.terminal')}
                description={t('sidebar.terminalDescription')}
                onClick={() => onChangeView('terminal')}
            />
        </SidebarSection>
    );
};

ToolsSectionComponent.displayName = 'ToolsSection';
