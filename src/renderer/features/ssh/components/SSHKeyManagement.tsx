/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { SSHKnownHostEntry, SSHManagedKey } from '@/types';
import { appLogger } from '@/utils/renderer-logger';

interface SSHKeyManagementProps {
    t: (key: string, params?: Record<string, string | number>) => string;
}

interface HostTrustRecord {
    host: string;
    keyType: string;
    fingerprint: string;
    decision: 'trusted' | 'rejected';
    updatedAt: number;
}

const SSH_TRUST_CENTER_STORAGE_KEY = 'ssh.trust-center.records.v1';

function fingerprintOf(publicKey: string): string {
    let hash = 0;
    for (let index = 0; index < publicKey.length; index += 1) {
        hash = ((hash << 5) - hash + publicKey.charCodeAt(index)) | 0;
    }
    return `fp-${Math.abs(hash).toString(16)}`;
}

function loadTrustRecords(): HostTrustRecord[] {
    try {
        const raw = localStorage.getItem(SSH_TRUST_CENTER_STORAGE_KEY);
        if (!raw) {
            return [];
        }
        return JSON.parse(raw) as HostTrustRecord[];
    } catch {
        return [];
    }
}

function saveTrustRecords(records: HostTrustRecord[]): void {
    localStorage.setItem(SSH_TRUST_CENTER_STORAGE_KEY, JSON.stringify(records));
}

export const SSHKeyManagement: React.FC<SSHKeyManagementProps> = ({ t }) => {
    const [keys, setKeys] = useState<SSHManagedKey[]>([]);
    const [knownHosts, setKnownHosts] = useState<SSHKnownHostEntry[]>([]);
    const [keyName, setKeyName] = useState('');
    const [passphrase, setPassphrase] = useState('');
    const [importName, setImportName] = useState('');
    const [importKey, setImportKey] = useState('');
    const [knownHost, setKnownHost] = useState<SSHKnownHostEntry>({ host: '', keyType: 'ssh-ed25519', publicKey: '' });
    const [status, setStatus] = useState('');
    const [trustRecords, setTrustRecords] = useState<HostTrustRecord[]>([]);

    const loadData = useCallback(async () => {
        try {
            const [managedKeys, hosts] = await Promise.all([
                window.electron.ssh.listManagedKeys(),
                window.electron.ssh.listKnownHosts()
            ]);
            setKeys(managedKeys);
            setKnownHosts(hosts);
            setTrustRecords(loadTrustRecords());
        } catch (error) {
            appLogger.error('SSHKeyManagement', 'Failed to load SSH key data', error as Error);
        }
    }, []);

    const reviewQueue = useMemo<Array<SSHKnownHostEntry & { fingerprint: string; previousFingerprint?: string }>>(() => {
        return knownHosts.flatMap(host => {
            const fingerprint = fingerprintOf(host.publicKey);
            const record = trustRecords.find(saved =>
                saved.host === host.host
                && saved.keyType === host.keyType
            );
            if (!record) {
                return [{ ...host, fingerprint }];
            }
            if (record.fingerprint !== fingerprint) {
                return [{ ...host, fingerprint, previousFingerprint: record.fingerprint }];
            }
            return [];
        });
    }, [knownHosts, trustRecords]);

    const applyTrustDecision = useCallback((
        hostEntry: SSHKnownHostEntry,
        fingerprint: string,
        decision: 'trusted' | 'rejected'
    ) => {
        const nextRecords = [
            ...trustRecords.filter(record =>
                !(record.host === hostEntry.host && record.keyType === hostEntry.keyType)
            ),
            {
                host: hostEntry.host,
                keyType: hostEntry.keyType,
                fingerprint,
                decision,
                updatedAt: Date.now(),
            }
        ];
        setTrustRecords(nextRecords);
        saveTrustRecords(nextRecords);
        setStatus(
            decision === 'trusted'
                ? t('ssh.trustDecisionTrusted', { host: hostEntry.host })
                : t('ssh.trustDecisionRejected', { host: hostEntry.host })
        );
    }, [t, trustRecords]);

    useEffect(() => {
        const init = async () => {
            await loadData();
        };

        void init().catch((error: Error) => {
            appLogger.error('SSHKeyManagement', 'Failed to load SSH key data', error);
        });
    }, [loadData]);

    const runAction = useCallback(async (action: () => Promise<void>, successMessage: string) => {
        try {
            await action();
            setStatus(successMessage);
            await loadData();
        } catch (error) {
            appLogger.error('SSHKeyManagement', 'SSH key action failed', error as Error);
            setStatus(t('ssh.keyActionFailed'));
        }
    }, [loadData, t]);

    return (
        <div className="p-4 space-y-4 overflow-auto h-full">
            <div className="text-sm text-muted-foreground">{status}</div>
            <div className="grid grid-cols-2 gap-4">
                <section className="border border-border rounded-lg p-3 space-y-2">
                    <h4 className="font-medium">{t('ssh.generateKey')}</h4>
                    <input value={keyName} onChange={e => setKeyName(e.target.value)} placeholder={t('ssh.keyName')} className="w-full px-2 py-1 rounded bg-background border border-border" />
                    <input type="password" value={passphrase} onChange={e => setPassphrase(e.target.value)} placeholder={t('ssh.keyPassphraseOptional')} className="w-full px-2 py-1 rounded bg-background border border-border" />
                    <button
                        className="primary-btn w-full"
                        onClick={() => { void runAction(async () => { await window.electron.ssh.generateManagedKey({ name: keyName, passphrase: passphrase || undefined }); setKeyName(''); setPassphrase(''); }, t('ssh.keyGenerated')); }}
                    >
                        {t('ssh.generateKey')}
                    </button>
                </section>
                <section className="border border-border rounded-lg p-3 space-y-2">
                    <h4 className="font-medium">{t('ssh.importKey')}</h4>
                    <input value={importName} onChange={e => setImportName(e.target.value)} placeholder={t('ssh.keyName')} className="w-full px-2 py-1 rounded bg-background border border-border" />
                    <textarea value={importKey} onChange={e => setImportKey(e.target.value)} placeholder={t('ssh.privateKey')} className="w-full px-2 py-1 rounded bg-background border border-border min-h-24" />
                    <button
                        className="secondary-btn w-full"
                        onClick={() => { void runAction(async () => { await window.electron.ssh.importManagedKey({ name: importName, privateKey: importKey, passphrase: undefined }); setImportName(''); setImportKey(''); }, t('ssh.keyImported')); }}
                    >
                        {t('ssh.importKey')}
                    </button>
                </section>
            </div>

            <section className="border border-border rounded-lg p-3 space-y-2">
                <h4 className="font-medium">{t('ssh.managedKeys')}</h4>
                <div className="space-y-2 max-h-56 overflow-auto pr-1">
                    {keys.map(key => (
                        <div key={key.id} className="flex items-center justify-between border border-border rounded px-2 py-1">
                            <div className="typo-caption">
                                <div className="font-medium">{key.name}</div>
                                <div className="text-muted-foreground">{key.fingerprint}</div>
                            </div>
                            <div className="flex gap-1">
                                <button className="secondary-btn typo-caption px-2 py-1" onClick={() => { void runAction(async () => { const backup = await window.electron.ssh.backupManagedKey(key.id); if (backup) { await window.electron.saveFile(backup.privateKey, backup.filename); } }, t('ssh.keyBackedUp')); }}>{t('ssh.backup')}</button>
                                <button className="secondary-btn typo-caption px-2 py-1" onClick={() => { void runAction(async () => { await window.electron.ssh.rotateManagedKey({ id: key.id }); }, t('ssh.keyRotated')); }}>{t('ssh.rotate')}</button>
                                <button className="secondary-btn typo-caption px-2 py-1" onClick={() => { void runAction(async () => { await window.electron.ssh.deleteManagedKey(key.id); }, t('ssh.keyDeleted')); }}>{t('common.delete')}</button>
                            </div>
                        </div>
                    ))}
                    {keys.length === 0 ? <div className="typo-caption text-muted-foreground">{t('ssh.noManagedKeys')}</div> : null}
                </div>
            </section>

            <section className="border border-border rounded-lg p-3 space-y-2">
                <h4 className="font-medium">{t('ssh.trustCenter')}</h4>
                {reviewQueue.length > 0 ? (
                    <div className="space-y-2">
                        <div className="typo-caption text-warning">{t('ssh.trustReviewRequired', { count: reviewQueue.length })}</div>
                        {reviewQueue.map((entry, index) => (
                            <div key={`${entry.host}-${entry.keyType}-${index}`} className="border border-warning/40 rounded px-2 py-2 typo-caption space-y-1">
                                <div>{entry.host} ({entry.keyType})</div>
                                <div>{t('ssh.trustFingerprintCurrent')}: {entry.fingerprint}</div>
                                {entry.previousFingerprint && (
                                    <div>{t('ssh.trustFingerprintPrevious')}: {entry.previousFingerprint}</div>
                                )}
                                <div className="flex gap-2">
                                    <button
                                        className="secondary-btn typo-caption px-2 py-1"
                                        onClick={() => applyTrustDecision(entry, entry.fingerprint, 'trusted')}
                                    >
                                        {t('ssh.trustApprove')}
                                    </button>
                                    <button
                                        className="secondary-btn typo-caption px-2 py-1"
                                        onClick={() => applyTrustDecision(entry, entry.fingerprint, 'rejected')}
                                    >
                                        {t('ssh.trustReject')}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="typo-caption text-muted-foreground">{t('ssh.trustNoAlerts')}</div>
                )}
                <div className="space-y-1 max-h-32 overflow-auto pr-1">
                    {trustRecords.map(record => (
                        <div key={`${record.host}-${record.keyType}`} className="typo-caption border border-border/40 rounded px-2 py-1">
                            {record.host} ({record.keyType}) • {record.decision} • {record.fingerprint}
                        </div>
                    ))}
                </div>
            </section>

            <section className="border border-border rounded-lg p-3 space-y-2">
                <h4 className="font-medium">{t('ssh.knownHosts')}</h4>
                <div className="grid grid-cols-3 gap-2">
                    <input value={knownHost.host} onChange={e => setKnownHost(prev => ({ ...prev, host: e.target.value }))} placeholder={t('ssh.host')} className="px-2 py-1 rounded bg-background border border-border" />
                    <input value={knownHost.keyType} onChange={e => setKnownHost(prev => ({ ...prev, keyType: e.target.value }))} placeholder={t('ssh.keyType')} className="px-2 py-1 rounded bg-background border border-border" />
                    <button className="secondary-btn" onClick={() => { void runAction(async () => { await window.electron.ssh.addKnownHost(knownHost); setKnownHost({ host: '', keyType: 'ssh-ed25519', publicKey: '' }); }, t('ssh.knownHostAdded')); }}>{t('ssh.addKnownHost')}</button>
                </div>
                <textarea value={knownHost.publicKey} onChange={e => setKnownHost(prev => ({ ...prev, publicKey: e.target.value }))} placeholder={t('ssh.publicKey')} className="w-full px-2 py-1 rounded bg-background border border-border min-h-16" />
                <div className="space-y-2 max-h-40 overflow-auto pr-1">
                    {knownHosts.map((entry, index) => (
                        <div key={`${entry.host}-${index}`} className="flex items-center justify-between border border-border rounded px-2 py-1">
                            <div className="typo-caption">{entry.host} ({entry.keyType})</div>
                            <button className="secondary-btn typo-caption px-2 py-1" onClick={() => { void runAction(async () => { await window.electron.ssh.removeKnownHost({ host: entry.host, keyType: entry.keyType }); }, t('ssh.knownHostRemoved')); }}>{t('common.delete')}</button>
                        </div>
                    ))}
                    {knownHosts.length === 0 ? <div className="typo-caption text-muted-foreground">{t('ssh.noKnownHosts')}</div> : null}
                </div>
            </section>
        </div>
    );
};
