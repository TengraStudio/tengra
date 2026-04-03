import { WorkspaceMountModals } from '@renderer/features/workspace/workspace-shell/WorkspaceMountModals';
import React from 'react';

import { useWorkspaceManager } from '@/features/workspace/hooks/useWorkspaceManager';
import { useWorkspaceState } from '@/features/workspace/hooks/useWorkspaceState';
import { Language } from '@/i18n';
import { Workspace } from '@/types';

import { LogoGeneratorModal } from '../workspace-dashboard/LogoGeneratorModal';

interface WorkspaceDialogsProps {
    ps: ReturnType<typeof useWorkspaceState>;
    wm: ReturnType<typeof useWorkspaceManager>;
    workspace: Workspace;
    submitEntryModal: () => Promise<void>;
    entryBusy: boolean;
    language: Language;
    handleUpdateWorkspace: (updates: Partial<Workspace>) => Promise<void>;
}

/** Aggregates all workspace modal dialogs (mount, entry, logo generator). */
export const WorkspaceDialogs: React.FC<WorkspaceDialogsProps> = ({
    ps,
    wm,
    workspace,
    submitEntryModal,
    entryBusy,
    language,
    handleUpdateWorkspace,
}) => (
    <>
        <WorkspaceMountModals
            showMountModal={ps.showMountModal}
            setShowMountModal={ps.setShowMountModal}
            mountForm={wm.mountForm}
            setMountForm={wm.setMountForm}
            addMount={() => {
                void wm.addMount();
            }}
            pickLocalFolder={() => {
                void wm.pickLocalFolder();
            }}
            entryModal={ps.entryModal}
            closeEntryModal={() => ps.setEntryModal(null)}
            entryName={ps.entryName}
            setEntryName={ps.setEntryName}
            submitEntryModal={() => {
                void submitEntryModal();
            }}
            entryBusy={entryBusy}
            selectedCount={ps.selectedEntries.length}
            language={language}
        />

        {ps.showLogoModal && (
            <LogoGeneratorModal
                isOpen={ps.showLogoModal}
                onClose={() => ps.setShowLogoModal(false)}
                workspace={workspace}
                onApply={logoPath => {
                    void (async () => {
                        await handleUpdateWorkspace({
                            logo: logoPath,
                            updatedAt: Date.now(),
                        });
                        ps.setShowLogoModal(false);
                    })();
                }}
                language={language}
            />
        )}
    </>
);
