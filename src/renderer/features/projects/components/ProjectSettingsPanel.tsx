import React, { useState } from 'react';

import { Language, useTranslation } from '@/i18n';
import { AgentDefinition, Project } from '@/types';

import { useProjectSettingsForm } from '../hooks/useProjectSettingsForm';

import { AdvancedSection } from './settings/AdvancedSection';
import { BuildSection } from './settings/BuildSection';
import { CouncilSection } from './settings/CouncilSection';
import { DevServerSection } from './settings/DevServerSection';
import { GeneralSection } from './settings/GeneralSection';
import { SettingsHeader } from './settings/SettingsHeader';
import { SettingsSidebar } from './settings/SettingsSidebar';
import { ProjectSettingsSection } from './settings/types';
import { WorkspaceSection } from './settings/WorkspaceSection';

interface ProjectSettingsPanelProps {
    project: Project
    onUpdate: (updates: Partial<Project>) => Promise<void>
    language: Language
    availableAgents: AgentDefinition[]
    onAddMount: () => void
    onRemoveMount: (id: string) => void
}

/**
 * Project settings surface with section-based navigation.
 */
const ProjectSettingsPanelBase: React.FC<ProjectSettingsPanelProps> = ({
    project, onUpdate, language, availableAgents, onAddMount, onRemoveMount
}) => {
    const { t } = useTranslation(language);
    const [activeSection, setActiveSection] = useState<ProjectSettingsSection>('general');

    const {
        formData,
        setFormData,
        isDirty,
        handleSave,
        handleReset,
        toggleMember
    } = useProjectSettingsForm(project, onUpdate);

    return (
        <section
            aria-label="Project settings panel"
            className="h-full flex flex-col bg-background/50 backdrop-blur-md overflow-hidden"
        >
            <SettingsHeader
                t={t}
                projectTitle={project.title}
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

                <main className="flex-1 overflow-y-auto custom-scrollbar p-8" aria-label="Project settings content">
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
                                project={project}
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

export const ProjectSettingsPanel = React.memo(ProjectSettingsPanelBase);
ProjectSettingsPanel.displayName = 'ProjectSettingsPanel';
