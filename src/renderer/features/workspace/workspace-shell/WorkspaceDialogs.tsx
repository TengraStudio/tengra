import { WorkspaceMountModals } from '@renderer/features/workspace/workspace-shell/WorkspaceMountModals';
import React from 'react';

import { useWorkspaceManager } from '@/features/workspace/hooks/useWorkspaceManager';
import { useWorkspaceState } from '@/features/workspace/hooks/useWorkspaceState';
import { Language } from '@/i18n';

interface WorkspaceDialogsProps {
    ps: ReturnType<typeof useWorkspaceState>;
    wm: ReturnType<typeof useWorkspaceManager>;
    submitEntryModal: () => Promise<void>;
    entryBusy: boolean;
    language: Language;
}

/** Aggregates all workspace modal dialogs (mount, entry, logo generator). */
export const WorkspaceDialogs: React.FC<WorkspaceDialogsProps> = ({
    ps,
    wm,
    submitEntryModal,
    entryBusy,
    language,
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
    </>
);
