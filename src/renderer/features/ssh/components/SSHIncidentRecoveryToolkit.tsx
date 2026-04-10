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
        { id: 'auth', command: 'whoami && id', label: t('ssh.recoveryAuthDiagnostic') },
        { id: 'network', command: 'hostname && ip route || route -n', label: t('ssh.recoveryNetworkDiagnostic') },
        { id: 'permission', command: 'pwd && ls -ld . && ls -la', label: t('ssh.recoveryPermissionDiagnostic') },
    ], [t]);

    const runDiagnostic = async (entry: DiagnosticCommand): Promise<void> => {
        setRunningId(entry.id);
        const result = await window.electron.ssh.execute(connectionId, entry.command);
        const success = result.code === 0;
        setOutput(`${result.stdout}\n${result.stderr}`.trim());
        setStatus(
            success
                ? t('ssh.recoveryDiagnosticOk')
                : t('ssh.recoveryDiagnosticFailed', { code: result.code })
        );
        setRunningId(null);
    };

    const copySnippet = async (snippet: string): Promise<void> => {
        await window.electron.clipboard.writeText(snippet);
        setStatus(t('ssh.recoverySnippetCopied'));
    };

    return (
        <div className="p-4 space-y-3">
            <div className="text-sm font-semibold">{t('ssh.recoveryToolkit')}</div>
            <div className="typo-caption text-muted-foreground">{t('ssh.recoveryToolkitSubtitle')}</div>
            <div className="flex flex-wrap gap-2">
                {commands.map(entry => (
                    <button
                        key={entry.id}
                        className="secondary-btn typo-caption"
                        disabled={runningId !== null}
                        onClick={() => { void runDiagnostic(entry); }}
                    >
                        {runningId === entry.id ? t('ssh.recoveryRunning') : entry.label}
                    </button>
                ))}
            </div>
            <div className="space-y-2">
                <div className="typo-caption font-medium">{t('ssh.recoveryRepairSteps')}</div>
                <div className="grid gap-2">
                    {[
                        'sudo systemctl status ssh',
                        'sudo systemctl restart ssh',
                        'sudo chmod 700 ~/.ssh && sudo chmod 600 ~/.ssh/authorized_keys',
                    ].map(snippet => (
                        <div key={snippet} className="flex items-center justify-between gap-2 border border-border/40 rounded px-2 py-1">
                            <code className="typo-caption truncate">{snippet}</code>
                            <button className="secondary-btn typo-caption px-2 py-1" onClick={() => { void copySnippet(snippet); }}>
                                {t('ssh.recoveryCopySnippet')}
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
