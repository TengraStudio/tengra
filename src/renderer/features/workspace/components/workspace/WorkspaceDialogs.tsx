import React from 'react';

import { LogoGeneratorModal } from '@/features/workspace/components/LogoGeneratorModal';
import { WorkspaceModals } from '@/features/workspace/components/workspace/WorkspaceModals';
import { useWorkspaceManager } from '@/features/workspace/hooks/useWorkspaceManager';
import { useWorkspaceState } from '@/features/workspace/hooks/useWorkspaceState';
import { Language } from '@/i18n';
import type { Workspace } from '@/types';
import { appLogger } from '@/utils/renderer-logger';

interface WorkspaceDialogsProps {
    ps: ReturnType<typeof useWorkspaceState>;
    wm: ReturnType<typeof useWorkspaceManager>;
    workspace: Workspace;
    handleUpdateWorkspace: (updates: Partial<Workspace>) => Promise<void>;
    submitEntryModal: () => Promise<void>;
    entryBusy: boolean;
    language: Language;
}

/** Aggregates all workspace modal dialogs (mount, entry, logo generator). */
export const WorkspaceDialogs: React.FC<WorkspaceDialogsProps> = ({
    ps,
    wm,
    workspace,
    handleUpdateWorkspace,
    submitEntryModal,
    entryBusy,
    language,
}) => (
    <>
        <WorkspaceModals
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

        <LogoGeneratorModal
            isOpen={ps.showLogoModal}
            onClose={() => ps.setShowLogoModal(false)}
            workspace={workspace}
            onApply={(logoPath: string) => {
                void handleUpdateWorkspace({ logo: logoPath }).then(() =>
                    ps.setShowLogoModal(false)
                ).catch(error => {
                    appLogger.error('WorkspaceDialogs', 'Failed to apply generated logo', error as Error);
                });
            }}
            language={language}
        />
    </>
);
