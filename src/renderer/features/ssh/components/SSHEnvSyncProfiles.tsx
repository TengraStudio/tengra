import React, { useMemo, useState } from 'react';

interface SSHEnvSyncProfilesProps {
    connectionId: string;
    t: (key: string, params?: Record<string, string | number>) => string;
}

interface EnvSyncProfile {
    id: string;
    name: string;
    remotePath: string;
    desiredContent: string;
    kind: 'env' | 'shell';
}

interface EnvSyncRollbackEntry {
    profileId: string;
    remotePath: string;
    previousContent: string;
}

const ENV_SYNC_PROFILES_KEY = 'ssh.env-sync.profiles.v1';
const ENV_SYNC_ROLLBACKS_KEY = 'ssh.env-sync.rollbacks.v1';

function parseJson<T>(value: string | null, fallback: T): T {
    if (!value) {
        return fallback;
    }
    try {
        return JSON.parse(value) as T;
    } catch {
        return fallback;
    }
}

function computeDiffSummary(before: string, after: string): { added: number; removed: number } {
    const beforeLines = before.split('\n').filter(line => line.trim().length > 0);
    const afterLines = after.split('\n').filter(line => line.trim().length > 0);
    const beforeSet = new Set(beforeLines);
    const afterSet = new Set(afterLines);
    const added = afterLines.filter(line => !beforeSet.has(line)).length;
    const removed = beforeLines.filter(line => !afterSet.has(line)).length;
    return { added, removed };
}

export const SSHEnvSyncProfiles: React.FC<SSHEnvSyncProfilesProps> = ({ connectionId, t }) => {
    const [profiles, setProfiles] = useState<EnvSyncProfile[]>(() =>
        parseJson<EnvSyncProfile[]>(localStorage.getItem(ENV_SYNC_PROFILES_KEY), [])
    );
    const [selectedId, setSelectedId] = useState<string>('');
    const [remoteContent, setRemoteContent] = useState('');
    const [statusMessage, setStatusMessage] = useState('');
    const [name, setName] = useState('');
    const [remotePath, setRemotePath] = useState('');
    const [desiredContent, setDesiredContent] = useState('');
    const [kind, setKind] = useState<'env' | 'shell'>('env');

    const selectedProfile = useMemo(
        () => profiles.find(profile => profile.id === selectedId) ?? null,
        [profiles, selectedId]
    );
    const diffSummary = useMemo(() => {
        if (!selectedProfile) {
            return { added: 0, removed: 0 };
        }
        return computeDiffSummary(remoteContent, selectedProfile.desiredContent);
    }, [remoteContent, selectedProfile]);

    const persistProfiles = (nextProfiles: EnvSyncProfile[]): void => {
        setProfiles(nextProfiles);
        localStorage.setItem(ENV_SYNC_PROFILES_KEY, JSON.stringify(nextProfiles));
    };

    const handleSaveProfile = (): void => {
        if (name.trim().length === 0 || remotePath.trim().length === 0) {
            setStatusMessage(t('ssh.syncProfileValidation'));
            return;
        }
        const profile: EnvSyncProfile = {
            id: `${Date.now()}`,
            name: name.trim(),
            remotePath: remotePath.trim(),
            desiredContent,
            kind,
        };
        persistProfiles([profile, ...profiles]);
        setName('');
        setRemotePath('');
        setDesiredContent('');
        setStatusMessage(t('ssh.syncProfileSaved'));
    };

    const handlePreviewDiff = async (): Promise<void> => {
        if (!selectedProfile) {
            return;
        }
        const result = await window.electron.ssh.readFile(connectionId, selectedProfile.remotePath);
        setRemoteContent(result.success ? (result.content ?? '') : '');
        setStatusMessage(result.success ? t('ssh.syncDiffReady') : t('ssh.syncReadFailed'));
    };

    const handleApply = async (): Promise<void> => {
        if (!selectedProfile) {
            return;
        }
        const current = await window.electron.ssh.readFile(connectionId, selectedProfile.remotePath);
        if (current.success) {
            const rollbackEntries = parseJson<EnvSyncRollbackEntry[]>(
                localStorage.getItem(ENV_SYNC_ROLLBACKS_KEY),
                []
            );
            const rollbackEntry: EnvSyncRollbackEntry = {
                profileId: selectedProfile.id,
                remotePath: selectedProfile.remotePath,
                previousContent: current.content ?? '',
            };
            localStorage.setItem(
                ENV_SYNC_ROLLBACKS_KEY,
                JSON.stringify([rollbackEntry, ...rollbackEntries].slice(0, 20))
            );
        }
        const writeResult = await window.electron.ssh.writeFile(
            connectionId,
            selectedProfile.remotePath,
            selectedProfile.desiredContent
        );
        setStatusMessage(writeResult.success ? t('ssh.syncApplied') : t('ssh.syncApplyFailed'));
        if (writeResult.success) {
            setRemoteContent(selectedProfile.desiredContent);
        }
    };

    const handleRollback = async (): Promise<void> => {
        if (!selectedProfile) {
            return;
        }
        const rollbackEntries = parseJson<EnvSyncRollbackEntry[]>(
            localStorage.getItem(ENV_SYNC_ROLLBACKS_KEY),
            []
        );
        const rollback = rollbackEntries.find(entry => entry.profileId === selectedProfile.id);
        if (!rollback) {
            setStatusMessage(t('ssh.syncRollbackMissing'));
            return;
        }
        const result = await window.electron.ssh.writeFile(
            connectionId,
            rollback.remotePath,
            rollback.previousContent
        );
        setStatusMessage(result.success ? t('ssh.syncRollbackDone') : t('ssh.syncRollbackFailed'));
    };

    return (
        <div className="p-3 space-y-3 border-t border-border/40">
            <div className="text-sm font-semibold">{t('ssh.syncProfiles')}</div>
            <div className="grid grid-cols-2 gap-2">
                <input value={name} onChange={event => setName(event.target.value)} placeholder={t('ssh.syncProfileName')} />
                <input value={remotePath} onChange={event => setRemotePath(event.target.value)} placeholder={t('ssh.syncRemotePath')} />
            </div>
            <div className="flex gap-2">
                <select value={kind} onChange={event => setKind(event.target.value === 'shell' ? 'shell' : 'env')}>
                    <option value="env">{t('ssh.syncKindEnv')}</option>
                    <option value="shell">{t('ssh.syncKindShell')}</option>
                </select>
                <button className="secondary-btn" onClick={handleSaveProfile}>{t('ssh.syncSaveProfile')}</button>
            </div>
            <textarea
                value={desiredContent}
                onChange={event => setDesiredContent(event.target.value)}
                placeholder={t('ssh.syncDesiredContent')}
                style={{ minHeight: '90px' }}
            />
            <select value={selectedId} onChange={event => setSelectedId(event.target.value)}>
                <option value="">{t('ssh.syncSelectProfile')}</option>
                {profiles.map(profile => (
                    <option key={profile.id} value={profile.id}>{profile.name} ({profile.remotePath})</option>
                ))}
            </select>
            <div className="flex gap-2">
                <button className="secondary-btn" onClick={() => { void handlePreviewDiff(); }} disabled={!selectedProfile}>{t('ssh.syncPreviewDiff')}</button>
                <button className="primary-btn" onClick={() => { void handleApply(); }} disabled={!selectedProfile}>{t('ssh.syncApply')}</button>
                <button className="secondary-btn" onClick={() => { void handleRollback(); }} disabled={!selectedProfile}>{t('ssh.syncRollback')}</button>
            </div>
            <div className="typo-caption text-muted-foreground">
                {t('ssh.syncDiffSummary', { added: diffSummary.added, removed: diffSummary.removed })}
            </div>
            {statusMessage && <div className="typo-caption text-muted-foreground">{statusMessage}</div>}
        </div>
    );
};
