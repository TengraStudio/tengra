/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import React, { useCallback,useState } from 'react';

import { useSettings } from '@/context/SettingsContext';
import { useModelManager } from '@/features/models/hooks/useModelManager';
import { useWorkspaceSettingsForm } from '@/features/workspace/hooks/useWorkspaceSettingsForm';
import { Language, useTranslation } from '@/i18n';
import { AppSettings, Workspace } from '@/types';

import {
    CouncilSection,
    GeneralSection,
    GitSection,
    IntelligenceSection,
    PipelinesSection,
    SettingsHeader,
    SettingsSidebar,
    WorkspaceSection
} from '../components/settings';
import { WorkspaceSettingsSection } from '../components/settings/types';

interface WorkspaceSettingsPanelProps {
    workspace: Workspace
    onUpdate: (updates: Partial<Workspace>) => Promise<void>
    language: Language
    onAddMount: () => void
    onRemoveMount: (id: string) => void
    onDelete?: () => void
}


/**
 * Workspace settings surface with section-based navigation.
 */
const WorkspaceSettingsPanelBase: React.FC<WorkspaceSettingsPanelProps> = ({
    workspace, onUpdate, language, onAddMount, onRemoveMount, onDelete
}) => {
    const { t } = useTranslation(language);
    const { settings, updateSettings } = useSettings();
    const onSettingsUpdate = useCallback((s: AppSettings) => void updateSettings(s), [updateSettings]);
    const { models: allModels, groupedModels } = useModelManager(settings, onSettingsUpdate);

    // Deduplicate models by ID to prevent duplicate keys in multiple sections
    const models = React.useMemo(() => {
        const uniqueModels = new Map();
        for (const model of allModels) {
            const id = model.id;
            if (id && !uniqueModels.has(id)) {
                uniqueModels.set(id, model);
            }
        }
        return Array.from(uniqueModels.values());
    }, [allModels]);
    const [activeSection, setActiveSection] = useState<WorkspaceSettingsSection>('general');

    const {
        formData,
        setFormData,
        isDirty,
        handleSave,
        handleReset,
        toggleMember,
    } = useWorkspaceSettingsForm(workspace, onUpdate);

    return (
        <section
            aria-label={t('frontend.aria.workspaceSettingsPanel')}
            className="h-full flex flex-col bg-background/5 overflow-hidden"
        >
            <SettingsHeader
                t={t}
                workspaceTitle={workspace.title}
                isDirty={isDirty}
                onReset={handleReset}
                onSave={() => void handleSave()}
            />

            <div className="flex-1 flex overflow-hidden">
                <SettingsSidebar
                    activeSection={activeSection}
                    setActiveSection={setActiveSection}
                    t={t}
                />

                <main className="flex-1 overflow-y-auto custom-scrollbar p-12" aria-label={t('frontend.aria.workspaceSettingsContent')}>
                    <div className="max-w-2xl mx-auto">
                        {activeSection === 'general' && (
                            <GeneralSection formData={formData} setFormData={setFormData} t={t} models={models} settings={settings ?? undefined} groupedModels={groupedModels} />
                        )}

                        {activeSection === 'intelligence' && (
                            <IntelligenceSection formData={formData} setFormData={setFormData} t={t} models={models} settings={settings ?? undefined} groupedModels={groupedModels} />
                        )}

                        {activeSection === 'council' && (
                            <CouncilSection
                                formData={formData}
                                setFormData={setFormData}
                                availableAgents={models.map(m => ({
                                    id: m.id || 'unknown',
                                    name: m.name || m.id || 'Unknown',
                                    provider: m.provider || 'unknown',
                                    systemPrompt: ''
                                }))}
                                toggleMember={toggleMember}
                                t={t}
                                models={models}
                                settings={settings ?? undefined}
                                groupedModels={groupedModels}
                            />
                        )}

                        {activeSection === 'git' && (
                            <GitSection formData={formData} setFormData={setFormData} t={t} models={models} settings={settings ?? undefined} groupedModels={groupedModels} />
                        )}

                        {activeSection === 'workspace' && (
                            <WorkspaceSection
                                workspace={workspace}
                                onAddMount={onAddMount}
                                onRemoveMount={onRemoveMount}
                                onDelete={onDelete}
                                t={t}
                            />
                        )}

                        {activeSection === 'pipelines' && (
                            <PipelinesSection formData={formData} setFormData={setFormData} t={t} models={models} settings={settings ?? undefined} groupedModels={groupedModels} />
                        )}
                    </div>
                </main>
            </div>
        </section>
    );
};

export const WorkspaceSettingsPanel = React.memo(WorkspaceSettingsPanelBase);
WorkspaceSettingsPanel.displayName = 'WorkspaceSettingsPanel';
