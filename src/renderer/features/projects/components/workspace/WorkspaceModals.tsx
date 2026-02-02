import { X } from 'lucide-react';
import React, { Dispatch, SetStateAction } from 'react';

import { Language, useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { MountForm, WorkspaceEntry } from '@/types';

interface WorkspaceModalsProps {
    showMountModal: boolean;
    setShowMountModal: (val: boolean) => void;
    mountForm: MountForm;
    setMountForm: Dispatch<SetStateAction<MountForm>>;
    addMount: () => void;
    pickLocalFolder: () => void;
    entryModal: { type: string, entry?: WorkspaceEntry } | null;
    closeEntryModal: () => void;
    entryName: string;
    setEntryName: (val: string) => void;
    submitEntryModal: () => void;
    entryBusy: boolean;
    language?: Language;
}

interface MountTypeToggleProps {
    type: 'local' | 'ssh';
    setMountForm: Dispatch<SetStateAction<MountForm>>;
    t: (key: string) => string;
}

const MountTypeToggle: React.FC<MountTypeToggleProps> = ({ type, setMountForm, t }) => (
    <div className="grid grid-cols-2 gap-2 bg-black/20 p-1 rounded-lg">
        <button
            onClick={() => setMountForm((prev) => ({ ...prev, type: 'local' }))}
            className={cn("py-2 text-xs font-medium rounded-md transition-all", type === 'local' ? "bg-white/10 text-foreground" : "text-muted-foreground hover:text-zinc-300")}
        >
            {t('workspaceModals.existingFolder')}
        </button>
        <button
            onClick={() => setMountForm((prev) => ({ ...prev, type: 'ssh' }))}
            className={cn("py-2 text-xs font-medium rounded-md transition-all", type === 'ssh' ? "bg-white/10 text-foreground" : "text-muted-foreground hover:text-zinc-300")}
        >
            {t('workspaceModals.sshServer')}
        </button>
    </div>
);

interface LocalMountFormProps {
    mountForm: MountForm;
    setMountForm: Dispatch<SetStateAction<MountForm>>;
    pickLocalFolder: () => void;
    t: (key: string) => string;
}

const LocalMountForm: React.FC<LocalMountFormProps> = ({ mountForm, setMountForm, pickLocalFolder, t }) => (
    <div className="space-y-2">
        <label className="text-xs text-muted-foreground font-medium">{t('workspaceModals.folderPath')}</label>
        <div className="flex gap-2">
            <input
                type="text"
                value={mountForm.rootPath || ''}
                onChange={e => setMountForm((prev) => ({ ...prev, rootPath: e.target.value }))}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-success/50"
                placeholder={t('workspace.placeholders.rootPath')}
            />
            <button onClick={pickLocalFolder} className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-foreground text-xs font-medium">{t('workspaceModals.pick')}</button>
        </div>
    </div>
);

interface SSHMountFormProps {
    mountForm: MountForm;
    setMountForm: Dispatch<SetStateAction<MountForm>>;
    t: (key: string) => string;
}

const SSHMountForm: React.FC<SSHMountFormProps> = ({ mountForm, setMountForm, t }) => (
    <div className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1">
                <label className="text-xs text-muted-foreground">{t('workspaceModals.host')}</label>
                <input type="text" value={mountForm.host || ''} onChange={e => setMountForm((prev) => ({ ...prev, host: e.target.value }))} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-foreground" />
            </div>
            <div className="space-y-1">
                <label className="text-xs text-muted-foreground">{t('workspaceModals.port')}</label>
                <input type="text" value={mountForm.port || ''} onChange={e => setMountForm((prev) => ({ ...prev, port: e.target.value }))} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-foreground" />
            </div>
        </div>
        <div className="space-y-1">
            <label className="text-xs text-muted-foreground">{t('workspaceModals.username')}</label>
            <input type="text" value={mountForm.username || ''} onChange={e => setMountForm((prev) => ({ ...prev, username: e.target.value }))} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-foreground" />
        </div>
    </div>
);

interface MountModalProps {
    showMountModal: boolean;
    setShowMountModal: (val: boolean) => void;
    mountForm: MountForm;
    setMountForm: Dispatch<SetStateAction<MountForm>>;
    addMount: () => void;
    pickLocalFolder: () => void;
    t: (key: string) => string;
}

const MountModal: React.FC<MountModalProps> = ({ showMountModal, setShowMountModal, mountForm, setMountForm, addMount, pickLocalFolder, t }) => {
    if (!showMountModal) { return null; }
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-card border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
                <div className="p-4 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                    <h3 className="text-sm font-bold text-foreground">{t('workspaceModals.mountTitle')}</h3>
                    <button onClick={() => setShowMountModal(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
                </div>
                <div className="p-6 space-y-4">
                    <MountTypeToggle type={mountForm.type} setMountForm={setMountForm} t={t} />
                    {mountForm.type === 'local'
                        ? <LocalMountForm mountForm={mountForm} setMountForm={setMountForm} pickLocalFolder={pickLocalFolder} t={t} />
                        : <SSHMountForm mountForm={mountForm} setMountForm={setMountForm} t={t} />
                    }
                    <div className="flex justify-end gap-2 mt-4">
                        <button onClick={() => setShowMountModal(false)} className="px-4 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-white/5">{t('workspaceModals.cancel')}</button>
                        <button onClick={addMount} className="px-4 py-2 rounded-lg text-xs font-semibold bg-success text-background hover:bg-success">{t('workspaceModals.add')}</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

interface EntryModalProps {
    entryModal: { type: string, entry?: WorkspaceEntry } | null;
    closeEntryModal: () => void;
    entryName: string;
    setEntryName: (val: string) => void;
    submitEntryModal: () => void;
    entryBusy: boolean;
    t: (key: string) => string;
}

const EntryModal: React.FC<EntryModalProps> = ({ entryModal, closeEntryModal, entryName, setEntryName, submitEntryModal, entryBusy, t }) => {
    if (!entryModal) { return null; }
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-labelledby="workspace-modal-title">
            <div className="bg-card border border-white/10 rounded-xl w-full max-w-sm overflow-hidden shadow-2xl">
                <div className="p-4 border-b border-white/5 flex justify-between items-center">
                    <h3 id="workspace-modal-title" className="text-sm font-bold text-foreground capitalize">{entryModal.type}</h3>
                    <button onClick={closeEntryModal} className="text-muted-foreground hover:text-foreground" aria-label={t('workspaceModals.closeModal')}><X className="w-4 h-4" aria-hidden="true" /></button>
                </div>
                <div className="p-4 space-y-4">
                    {entryModal.type !== 'delete' && (
                        <input
                            autoFocus
                            type="text"
                            value={entryName}
                            onChange={(e) => setEntryName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') { submitEntryModal(); } else if (e.key === 'Escape') { closeEntryModal(); } }}
                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-success/50"
                            placeholder={t('workspace.placeholders.name')}
                            aria-label={`${entryModal.type} name`}
                        />
                    )}
                    {entryModal.type === 'delete' && (
                        <p className="text-sm text-muted-foreground">{t('workspaceModals.deleteConfirm').replace('{name}', entryModal.entry?.name ?? '')}</p>
                    )}
                    <div className="flex justify-end gap-2">
                        <button onClick={closeEntryModal} className="px-3 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-white/5" aria-label={t('workspaceModals.cancel')}>{t('workspaceModals.cancel')}</button>
                        <button onClick={submitEntryModal} disabled={entryBusy} className="px-3 py-2 rounded-lg text-xs font-semibold bg-success text-background hover:bg-success disabled:opacity-50">{entryBusy ? '...' : t('workspaceModals.confirm')}</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

/**
 * WorkspaceModals Component
 * 
 * Consolidates all dialogs and modals used within the workspace:
 * - Mount creation (Local/SSH)
 * - File/Folder CRUD operations (Create, Rename, Delete)
 * - Search dialog
 */
export const WorkspaceModals: React.FC<WorkspaceModalsProps> = ({
    showMountModal, setShowMountModal, mountForm, setMountForm, addMount, pickLocalFolder,
    entryModal, closeEntryModal, entryName, setEntryName, submitEntryModal, entryBusy, language = 'en'
}) => {
    const { t } = useTranslation(language);
    return (
        <>
            <MountModal showMountModal={showMountModal} setShowMountModal={setShowMountModal} mountForm={mountForm} setMountForm={setMountForm} addMount={addMount} pickLocalFolder={pickLocalFolder} t={t} />
            <EntryModal entryModal={entryModal} closeEntryModal={closeEntryModal} entryName={entryName} setEntryName={setEntryName} submitEntryModal={submitEntryModal} entryBusy={entryBusy} t={t} />
        </>
    );
};
