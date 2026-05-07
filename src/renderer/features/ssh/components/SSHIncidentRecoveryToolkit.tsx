/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import React, { useMemo, useState } from 'react';

interface SSHIncidentRecoveryToolkitProps {
    connectionId: string;
    t: (key: string, params?: Record<string, string | number>) => string;
}

interface DiagnosticCommand {
    id: 'auth' | 'network' | 'permission';
    command: string;
    label: string;
}

export const SSHIncidentRecoveryToolkit: React.FC<SSHIncidentRecoveryToolkitProps> = ({
    connectionId,
    t,
}) => {
    const [output, setOutput] = useState('');
    const [runningId, setRunningId] = useState<string | null>(null);
    const [status, setStatus] = useState('');

    const commands = useMemo<DiagnosticCommand[]>(() => [
        { id: 'auth', command: 'whoami && id', label: t('frontend.ssh.recoveryAuthDiagnostic') },
        { id: 'network', command: 'hostname && ip route || route -n', label: t('frontend.ssh.recoveryNetworkDiagnostic') },
        { id: 'permission', command: 'pwd && ls -ld . && ls -la', label: t('frontend.ssh.recoveryPermissionDiagnostic') },
    ], [t]);

    const runDiagnostic = async (entry: DiagnosticCommand): Promise<void> => {
        setRunningId(entry.id);
        const result = await window.electron.ssh.execute(connectionId, entry.command);
        const success = result.code === 0;
        setOutput(`${result.stdout}\n${result.stderr}`.trim());
        setStatus(
            success
                ? t('frontend.ssh.recoveryDiagnosticOk')
                : t('frontend.ssh.recoveryDiagnosticFailed', { code: result.code })
        );
        setRunningId(null);
    };

    const copySnippet = async (snippet: string): Promise<void> => {
        await window.electron.clipboard.writeText(snippet);
        setStatus(t('frontend.ssh.recoverySnippetCopied'));
    };

    return (
        <div className="p-4 space-y-3">
            <div className="text-sm font-semibold">{t('frontend.ssh.recoveryToolkit')}</div>
            <div className="typo-caption text-muted-foreground">{t('frontend.ssh.recoveryToolkitSubtitle')}</div>
            <div className="flex flex-wrap gap-2">
                {commands.map(entry => (
                    <button
                        key={entry.id}
                        className="secondary-btn typo-caption"
                        disabled={runningId !== null}
                        onClick={() => { void runDiagnostic(entry); }}
                    >
                        {runningId === entry.id ? t('frontend.ssh.recoveryRunning') : entry.label}
                    </button>
                ))}
            </div>
            <div className="space-y-2">
                <div className="typo-caption font-medium">{t('frontend.ssh.recoveryRepairSteps')}</div>
                <div className="grid gap-2">
                    {[
                        'sudo systemctl status ssh',
                        'sudo systemctl restart ssh',
                        'sudo chmod 700 ~/.ssh && sudo chmod 600 ~/.ssh/authorized_keys',
                    ].map(snippet => (
                        <div key={snippet} className="flex items-center justify-between gap-2 border border-border/40 rounded px-2 py-1">
                            <code className="typo-caption truncate">{snippet}</code>
                            <button className="secondary-btn typo-caption px-2 py-1" onClick={() => { void copySnippet(snippet); }}>
                                {t('frontend.ssh.recoveryCopySnippet')}
                            </button>
                        </div>
                    ))}
                </div>
            </div>
            {status && <div className="typo-caption text-muted-foreground">{status}</div>}
            {output && (
                <pre className="typo-caption whitespace-pre-wrap bg-background border border-border/40 rounded p-2 max-h-64 overflow-auto">
                    {output}
                </pre>
            )}
        </div>
    );
};

