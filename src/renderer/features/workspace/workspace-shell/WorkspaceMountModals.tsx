import { SavedProfileSelector } from '@renderer/features/workspace/workspace-shell/SavedProfileSelector';
import { X } from 'lucide-react';
import React, { Dispatch, SetStateAction } from 'react';

import { Language, useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { MountForm, WorkspaceEntry } from '@/types';
import { SSHConnection, SSHProfileTestResult } from '@/types/ssh';

interface WorkspaceModalsProps {
    showMountModal: boolean;
    setShowMountModal: (val: boolean) => void;
    mountForm: MountForm;
    setMountForm: Dispatch<SetStateAction<MountForm>>;
    addMount: () => void;
    pickLocalFolder: () => void;
    entryModal: { type: string; entry?: WorkspaceEntry } | null;
    closeEntryModal: () => void;
    entryName: string;
    setEntryName: (val: string) => void;
    submitEntryModal: () => void;
    entryBusy: boolean;
    selectedCount: number;
    language?: Language;
    testConnection?: (form: MountForm) => Promise<SSHProfileTestResult>;
}

interface MountTypeToggleProps {
    type: 'local' | 'ssh';
    setMountForm: Dispatch<SetStateAction<MountForm>>;
    t: (key: string) => string;
}

const MountTypeToggle: React.FC<MountTypeToggleProps> = ({ type, setMountForm, t }) => (
    <div className="grid grid-cols-2 gap-2 bg-background/50 p-1 rounded-lg">
        <button
            onClick={() => setMountForm(prev => ({ ...prev, type: 'local' }))}
            className={cn(
                'py-2 typo-caption font-medium rounded-md transition-all',
                type === 'local'
                    ? 'bg-muted/60 text-foreground'
                    : 'text-muted-foreground hover:text-muted-foreground'
            )}
        >
            {t('workspaceModals.existingFolder')}
        </button>
        <button
            onClick={() => setMountForm(prev => ({ ...prev, type: 'ssh' }))}
            className={cn(
                'py-2 typo-caption font-medium rounded-md transition-all',
                type === 'ssh'
                    ? 'bg-muted/60 text-foreground'
                    : 'text-muted-foreground hover:text-muted-foreground'
            )}
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

const LocalMountForm: React.FC<LocalMountFormProps> = ({
    mountForm,
    setMountForm,
    pickLocalFolder,
    t,
}) => (
    <div className="space-y-2">
        <label className="typo-caption text-muted-foreground font-medium">
            {t('workspaceModals.folderPath')}
        </label>
        <div className="flex gap-2">
            <input
                type="text"
                value={mountForm.rootPath || ''}
                onChange={e => setMountForm(prev => ({ ...prev, rootPath: e.target.value }))}
                className="w-full bg-background/70 border border-border/40 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-success/50"
                placeholder={t('workspace.placeholders.rootPath')}
            />
            <button
                onClick={pickLocalFolder}
                className="px-3 py-2 rounded-lg bg-muted/40 hover:bg-muted/60 text-foreground typo-caption font-medium"
            >
                {t('workspaceModals.pick')}
            </button>
        </div>
    </div>
);

interface SSHMountFormProps {
    mountForm: MountForm;
    setMountForm: Dispatch<SetStateAction<MountForm>>;
    t: (key: string) => string;
    onSelectProfile: (profile: SSHConnection) => void;
    testConnection?: (form: MountForm) => Promise<SSHProfileTestResult>;
}


const SSHMountForm: React.FC<SSHMountFormProps> = ({
    mountForm,
    setMountForm,
    t,
    onSelectProfile,
    testConnection
}) => {
    const [testing, setTesting] = React.useState(false);
    const [testResult, setTestResult] = React.useState<SSHProfileTestResult | null>(null);

    const handleTest = async () => {
        if (!testConnection) {
            return;
        }
        setTesting(true);
        setTestResult(null);
        try {
            const result = await testConnection(mountForm);
            setTestResult(result);
        } catch (error) {
            setTestResult({
                success: false,
                message: t('errors.unexpected'),
                error: String(error),
                latencyMs: 0,
                authMethod: mountForm.authType
            });
        } finally {
            setTesting(false);
        }
    };

    const pickKeyFile = async () => {
        const result = await (window.electron.ipcRenderer.invoke('files:selectFile', {
            title: t('workspaceModals.selectPrivateKey'),
            filters: [{ name: t('common.privateKey'), extensions: ['*', 'pem', 'key'] }]
        }) as Promise<{ success: boolean; path?: string }>);
        if (result.success && result.path) {
            setMountForm(prev => ({ ...prev, privateKey: result.path || '' }));
        }
    };

    return (
        <div className="space-y-4">
            <SavedProfileSelector onSelect={onSelectProfile} t={t} />

            <div className="space-y-1">
                <label className="typo-caption text-muted-foreground font-medium">{t('workspaceModals.mountName')}</label>
                <input
                    type="text"
                    value={mountForm.name || ''}
                    onChange={e => setMountForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full bg-background/70 border border-border/40 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-success/50"
                    placeholder={t('workspaceModals.mountNamePlaceholder')}
                />
            </div>

            <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1">
                    <label className="typo-caption text-muted-foreground font-medium">{t('workspaceModals.host')}</label>
                    <input
                        type="text"
                        value={mountForm.host || ''}
                        onChange={e => setMountForm(prev => ({ ...prev, host: e.target.value }))}
                        className="w-full bg-background/70 border border-border/40 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-success/50"
                    />
                </div>
                <div className="space-y-1">
                    <label className="typo-caption text-muted-foreground font-medium">{t('workspaceModals.port')}</label>
                    <input
                        type="text"
                        value={mountForm.port || ''}
                        onChange={e => setMountForm(prev => ({ ...prev, port: e.target.value }))}
                        className="w-full bg-background/70 border border-border/40 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-success/50"
                    />
                </div>
            </div>

            <div className="space-y-1">
                <label className="typo-caption text-muted-foreground font-medium">{t('workspaceModals.username')}</label>
                <input
                    type="text"
                    value={mountForm.username || ''}
                    onChange={e => setMountForm(prev => ({ ...prev, username: e.target.value }))}
                    className="w-full bg-background/70 border border-border/40 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-success/50"
                />
            </div>

            <div className="space-y-2">
                <label className="typo-caption text-muted-foreground font-medium">{t('workspaceModals.authType')}</label>
                <div className="flex gap-2">
                    <button
                        onClick={() => setMountForm(prev => ({ ...prev, authType: 'password' }))}
                        className={cn(
                            "flex-1 py-1.5 tw-text-10   font-bold rounded border transition-all",
                            mountForm.authType === 'password'
                                ? "bg-success/10 border-success/50 text-success"
                                : "bg-muted/40 border-border/40 text-muted-foreground hover:bg-muted/60"
                        )}
                    >
                        {t('workspaceModals.password')}
                    </button>
                    <button
                        onClick={() => setMountForm(prev => ({ ...prev, authType: 'key' }))}
                        className={cn(
                            "flex-1 py-1.5 tw-text-10   font-bold rounded border transition-all",
                            mountForm.authType === 'key'
                                ? "bg-primary/10 border-primary/50 text-primary"
                                : "bg-muted/40 border-border/40 text-muted-foreground hover:bg-muted/60"
                        )}
                    >
                        {t('workspaceModals.sshKey')}
                    </button>
                </div>
            </div>

            {mountForm.authType === 'password' ? (
                <div className="space-y-1">
                    <label className="typo-caption text-muted-foreground font-medium">{t('workspaceModals.password')}</label>
                    <input
                        type="password"
                        value={mountForm.password || ''}
                        onChange={e => setMountForm(prev => ({ ...prev, password: e.target.value }))}
                        className="w-full bg-background/70 border border-border/40 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-success/50"
                    />
                </div>
            ) : (
                <div className="space-y-3">
                    <div className="space-y-1">
                        <label className="typo-caption text-muted-foreground font-medium">{t('workspaceModals.privateKey')}</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={mountForm.privateKey || ''}
                                onChange={e => setMountForm(prev => ({ ...prev, privateKey: e.target.value }))}
                                className="w-full bg-background/70 border border-border/40 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-success/50"
                                placeholder={t('workspaceModals.privateKey')}
                            />
                            <button
                                onClick={() => { void pickKeyFile(); }}
                                className="px-3 py-2 rounded-lg bg-muted/40 hover:bg-muted/60 text-foreground typo-caption font-medium"
                            >
                                {t('workspaceModals.pick')}
                            </button>
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="typo-caption text-muted-foreground font-medium">{t('workspaceModals.passphrase')}</label>
                        <input
                            type="password"
                            value={mountForm.passphrase || ''}
                            onChange={e => setMountForm(prev => ({ ...prev, passphrase: e.target.value }))}
                            className="w-full bg-background/70 border border-border/40 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-success/50"
                            placeholder={t('workspaceModals.optional')}
                        />
                    </div>
                </div>
            )}

            <div className="flex items-center gap-2 pt-1">
                <input
                    type="checkbox"
                    id="saveProfile"
                    checked={mountForm.saveProfile || false}
                    onChange={e => setMountForm(prev => ({ ...prev, saveProfile: e.target.checked }))}
                    className="w-3.5 h-3.5 rounded border-border/40 bg-background/70 text-success focus:ring-success/50"
                />
                <label htmlFor="saveProfile" className="typo-caption text-muted-foreground cursor-pointer select-none">
                    {t('workspaceModals.saveAsProfile')}
                </label>
            </div>

            <div className="pt-2">
                <button
                    onClick={() => { void handleTest(); }}
                    disabled={testing || !mountForm.host || !mountForm.username}
                    className={cn(
                        "w-full py-2 rounded-lg typo-caption font-semibold transition-all border",
                        testing
                            ? "bg-muted/40 border-border/40 text-muted-foreground animate-pulse"
                            : testResult?.success
                                ? "bg-success/10 border-success/30 text-success hover:bg-success/20"
                                : testResult?.success === false
                                    ? "bg-error/10 border-error/30 text-error hover:bg-error/20"
                                    : "bg-muted/40 border-border/40 text-foreground hover:bg-muted/60 hover:border-border/70"
                    )}
                >
                    {testing ? t('workspaceModals.testing') : t('workspaceModals.testConnection')}
                </button>
                {testResult && (
                    <div className={cn(
                        "mt-2 p-2 rounded tw-text-10 leading-relaxed border",
                        testResult.success
                            ? "bg-success/5 border-success/20 text-success/80"
                            : "bg-error/5 border-error/20 text-error/80"
                    )}>
                        {testResult.success
                            ? `${t('workspaceModals.testSuccess')} (${testResult.latencyMs}ms)`
                            : testResult.message || testResult.error}
                    </div>
                )}
            </div>
        </div>
    );
};


interface MountModalProps {
    showMountModal: boolean;
    setShowMountModal: (val: boolean) => void;
    mountForm: MountForm;
    setMountForm: Dispatch<SetStateAction<MountForm>>;
    addMount: () => void;
    pickLocalFolder: () => void;
    t: (key: string) => string;
    testConnection?: (form: MountForm) => Promise<SSHProfileTestResult>;
}

const MountModal: React.FC<MountModalProps> = ({
    showMountModal,
    setShowMountModal,
    mountForm,
    setMountForm,
    addMount,
    pickLocalFolder,
    t,
    testConnection,
}) => {
    if (!showMountModal) {
        return null;
    }

    const onSelectProfile = (profile: SSHConnection) => {
        setMountForm(prev => ({
            ...prev,
            name: profile.name,
            host: profile.host,
            port: String(profile.port),
            username: profile.username,
            authType: profile.authType || 'password',
            password: profile.password || '',
            privateKey: profile.privateKey || '',
            passphrase: profile.passphrase || '',
        }));
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm p-4">
            <div className="bg-card border border-border/40 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
                <div className="p-4 border-b border-border/30 flex justify-between items-center bg-muted/40">
                    <h3 className="text-sm font-bold text-foreground">
                        {t('workspaceModals.mountTitle')}
                    </h3>
                    <button
                        onClick={() => { setShowMountModal(false); }}
                        className="text-muted-foreground hover:text-foreground"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
                <div className="p-6 space-y-4">
                    <MountTypeToggle type={mountForm.type} setMountForm={setMountForm} t={t} />
                    {mountForm.type === 'local' ? (
                        <LocalMountForm
                            mountForm={mountForm}
                            setMountForm={setMountForm}
                            pickLocalFolder={pickLocalFolder}
                            t={t}
                        />
                    ) : (
                        <SSHMountForm
                            mountForm={mountForm}
                            setMountForm={setMountForm}
                            t={t}
                            onSelectProfile={onSelectProfile}
                            testConnection={testConnection}
                        />
                    )}
                    <div className="flex justify-end gap-2 mt-4">
                        <button
                            onClick={() => { setShowMountModal(false); }}
                            className="px-4 py-2 rounded-lg typo-caption font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40"
                        >
                            {t('workspaceModals.cancel')}
                        </button>
                        <button
                            onClick={() => { void addMount(); }}
                            className="px-4 py-2 rounded-lg typo-caption font-semibold bg-success text-background hover:bg-success"
                        >
                            {t('workspaceModals.add')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

interface EntryModalProps {
    entryModal: { type: string; entry?: WorkspaceEntry } | null;
    closeEntryModal: () => void;
    entryName: string;
    setEntryName: (val: string) => void;
    submitEntryModal: () => void;
    entryBusy: boolean;
    selectedCount: number;
    t: (key: string, options?: Record<string, unknown>) => string;
}

const EntryModal: React.FC<EntryModalProps> = ({
    entryModal,
    closeEntryModal,
    entryName,
    setEntryName,
    submitEntryModal,
    entryBusy,
    selectedCount,
    t,
}) => {
    if (!entryModal) {
        return null;
    }
    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="workspace-modal-title"
        >
            <div className="bg-card border border-border/40 rounded-xl w-full max-w-sm overflow-hidden shadow-2xl">
                <div className="p-4 border-b border-border/30 flex justify-between items-center">
                    <h3 id="workspace-modal-title" className="text-sm font-bold text-foreground">
                        {t(`workspaceModals.titles.${entryModal.type}`)}
                    </h3>
                    <button
                        onClick={closeEntryModal}
                        className="text-muted-foreground hover:text-foreground"
                        aria-label={t('workspaceModals.closeModal')}
                    >
                        <X className="w-4 h-4" aria-hidden="true" />
                    </button>
                </div>
                <div className="p-4 space-y-4">
                    {entryModal.type !== 'delete' && (
                        <input
                            autoFocus
                            type="text"
                            value={entryName}
                            onChange={e => setEntryName(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter') {
                                    submitEntryModal();
                                } else if (e.key === 'Escape') {
                                    closeEntryModal();
                                }
                            }}
                            className="w-full bg-background/70 border border-border/40 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-success/50"
                            placeholder={t('workspace.placeholders.name')}
                            aria-label={t('workspaceModals.inputAriaLabel', { type: entryModal.type })}
                        />
                    )}
                    {entryModal.type === 'delete' && (
                        <p className="text-sm text-muted-foreground">
                            {selectedCount > 1
                                ? t('workspaceModals.deleteMultipleConfirm').replace(
                                    '{count}',
                                    selectedCount.toString()
                                )
                                : t('workspaceModals.deleteConfirm').replace(
                                    '{name}',
                                    entryModal.entry?.name ?? ''
                                )}
                        </p>
                    )}
                    <div className="flex justify-end gap-2">
                        <button
                            onClick={closeEntryModal}
                            className="px-3 py-2 rounded-lg typo-caption font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40"
                            aria-label={t('workspaceModals.cancel')}
                        >
                            {t('workspaceModals.cancel')}
                        </button>
                        <button
                            onClick={submitEntryModal}
                            disabled={entryBusy}
                            className="px-3 py-2 rounded-lg typo-caption font-semibold bg-success text-background hover:bg-success disabled:opacity-50"
                        >
                            {entryBusy ? t('common.ellipsis') : t('workspaceModals.confirm')}
                        </button>
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
export const WorkspaceMountModals: React.FC<WorkspaceModalsProps> = ({
    showMountModal,
    setShowMountModal,
    mountForm,
    setMountForm,
    addMount,
    pickLocalFolder,
    entryModal,
    closeEntryModal,
    entryName,
    setEntryName,
    submitEntryModal,
    entryBusy,
    selectedCount,
    language = 'en',
}) => {
    const { t } = useTranslation(language);
    return (
        <>
            <MountModal
                showMountModal={showMountModal}
                setShowMountModal={setShowMountModal}
                mountForm={mountForm}
                setMountForm={setMountForm}
                addMount={addMount}
                pickLocalFolder={pickLocalFolder}
                t={t}
            />
            <EntryModal
                entryModal={entryModal}
                closeEntryModal={closeEntryModal}
                entryName={entryName}
                setEntryName={setEntryName}
                submitEntryModal={submitEntryModal}
                entryBusy={entryBusy}
                selectedCount={selectedCount}
                t={t}
            />
        </>
    );
};
