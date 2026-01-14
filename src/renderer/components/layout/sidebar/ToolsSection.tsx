import { SidebarMenuItem,SidebarSection } from '@renderer/components/layout/sidebar-components'
import { Container, Plug, Terminal } from 'lucide-react'
import React from 'react'

import { AppView } from '@/hooks/useAppState'
import { Language,useTranslation } from '@/i18n'

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
    language
}) => {
    const { t } = useTranslation(language as Language) // i18n helper might need cast if types are rigid

    if (isCollapsed) {
        return null
    }

    return (
        <SidebarSection
            id="tools"
            title={t('sidebar.tools') || 'Tools'}
            icon={<Plug className="w-3.5 h-3.5" />}
            defaultExpanded={false}
            badge={3}
        >
            <SidebarMenuItem
                id="mcp"
                icon={<Plug className="w-4 h-4" />}
                label="MCP Services"
                description="Model Context Protocol"
                onClick={() => onChangeView('mcp')}
                isActive={currentView === 'mcp'}
                status="online"
                statusLabel="3/3"
            />
            <SidebarMenuItem
                id="docker"
                icon={<Container className="w-4 h-4" />}
                label="Docker"
                description="Container management"
                onClick={() => { /* TODO: Add Docker view */ }}
                status="idle"
            />
            <SidebarMenuItem
                id="terminal"
                icon={<Terminal className="w-4 h-4" />}
                label="Terminal"
                description="Command line access"
                onClick={() => { /* TODO: Add Terminal */ }}
            />
        </SidebarSection>
    )
}
