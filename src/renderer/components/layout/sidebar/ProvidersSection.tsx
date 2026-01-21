import { SidebarMenuItem, SidebarSection } from '@renderer/components/layout/sidebar-components'
import { Brain, Cpu, Sparkles } from 'lucide-react'
import React from 'react'

import { SettingsCategory } from '@/features/settings/types'
import { Language, useTranslation } from '@/i18n'

interface ProvidersSectionProps {
    isCollapsed: boolean;
    language: string;
    onOpenSettings: (category: SettingsCategory) => void;
}

export const ProvidersSectionComponent: React.FC<ProvidersSectionProps> = ({
    isCollapsed,
    language,
    onOpenSettings
}) => {
    const { t } = useTranslation(language as Language)

    if (isCollapsed) {
        return null
    }

    return (
        <SidebarSection
            id="ai-providers"
            title={t('sidebar.aiProviders') || 'AI Providers'}
            icon={<Sparkles className="w-3.5 h-3.5" />}
            defaultExpanded={false}
            badge={4}
        >
            <SidebarMenuItem
                id="ollama"
                icon={<Brain className="w-4 h-4" />}
                label="Ollama"
                description="Local models"
                onClick={() => onOpenSettings('models' as SettingsCategory)}
                status="online"
                statusLabel="Running"
            />
            <SidebarMenuItem
                id="openai"
                icon={<Sparkles className="w-4 h-4" />}
                label="OpenAI"
                description="GPT-4, GPT-4o"
                onClick={() => onOpenSettings('models' as SettingsCategory)}
                status="online"
            />
            <SidebarMenuItem
                id="anthropic"
                icon={<Brain className="w-4 h-4" />}
                label="Anthropic"
                description="Claude 3.5"
                onClick={() => onOpenSettings('models' as SettingsCategory)}
                status="online"
            />
            <SidebarMenuItem
                id="copilot"
                icon={<Cpu className="w-4 h-4" />}
                label="GitHub Copilot"
                description="Code completion"
                onClick={() => onOpenSettings('accounts' as SettingsCategory)}
                status="online"
                statusLabel="Active"
            />
        </SidebarSection>
    )
}
