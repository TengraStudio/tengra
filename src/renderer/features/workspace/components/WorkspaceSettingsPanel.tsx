import React, { useState } from 'react';

import { Language, useTranslation } from '@/i18n';
import { AgentDefinition, Workspace } from '@/types';

import { useWorkspaceSettingsForm } from '../hooks/useWorkspaceSettingsForm';

import { AdvancedSection } from './settings/AdvancedSection';
import { BuildSection } from './settings/BuildSection';
import { CouncilSection } from './settings/CouncilSection';
import { DevServerSection } from './settings/DevServerSection';
import { GeneralSection } from './settings/GeneralSection';
import { SettingsHeader } from './settings/SettingsHeader';
import { SettingsSidebar } from './settings/SettingsSidebar';
import { WorkspaceSettingsSection } from './settings/types';
import { WorkspaceSection } from './settings/WorkspaceSection';

interface WorkspaceSettingsPanelProps {
    workspace: Workspace
    onUpdate: (updates: Partial<Workspace>) => Promise<void>
    language: Language
    availableAgents: AgentDefinition[]
    onAddMount: () => void
    onRemoveMount: (id: string) => void
}

/**
 * Workspace settings surface with section-based navigation.
 */
const WorkspaceSettingsPanelBase: React.FC<WorkspaceSettingsPanelProps> = ({
    workspace, onUpdate, language, availableAgents, onAddMount, onRemoveMount
}) => {
    const { t } = useTranslation(language);
    const [activeSection, setActiveSection] = useState<WorkspaceSettingsSection>('general');

    const {
        formData,
        setFormData,
        isDirty,
        handleSave,
        handleReset,
        toggleMember
    } = useWorkspaceSettingsForm(workspace, onUpdate);

    return (
        <section
            aria-label={t('aria.workspaceSettingsPanel')}
            className="h-full flex flex-col bg-background/50 backdrop-blur-md overflow-hidden"
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

                <main className="flex-1 overflow-y-auto custom-scrollbar p-8" aria-label={t('aria.workspaceSettingsContent')}>
                    <div className="max-w-3xl mx-auto space-y-10">
                        {activeSection === 'general' && (
                            <GeneralSection formData={formData} setFormData={setFormData} t={t} />
                        )}

                        {activeSection === 'council' && (
                            <CouncilSection
                                formData={formData}
                                setFormData={setFormData}
                                availableAgents={availableAgents}
                                toggleMember={toggleMember}
                                t={t}
                            />
                        )}

                        {activeSection === 'workspace' && (
                            <WorkspaceSection
                                workspace={workspace}
                                onAddMount={onAddMount}
                                onRemoveMount={onRemoveMount}
                                t={t}
                            />
                        )}

                        {activeSection === 'build' && (
                            <BuildSection formData={formData} setFormData={setFormData} t={t} />
                        )}

                        {activeSection === 'dev' && (
                            <DevServerSection formData={formData} setFormData={setFormData} t={t} />
                        )}

                        {activeSection === 'advanced' && (
                            <AdvancedSection formData={formData} setFormData={setFormData} t={t} />
                        )}
                    </div>
                </main>
            </div>
        </section>
    );
};

export const WorkspaceSettingsPanel = React.memo(WorkspaceSettingsPanelBase);
WorkspaceSettingsPanel.displayName = 'WorkspaceSettingsPanel';
