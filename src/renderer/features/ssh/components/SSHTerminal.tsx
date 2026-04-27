/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */


import React from 'react';

/* Batch-02: Extracted Long Classes */
const C_SSHTERMINAL_1 = "flex-1 bg-background rounded-lg p-3 font-mono text-sm overflow-y-auto whitespace-pre-wrap mb-3 border border-border/30 text-success";


interface SSHTerminalProps {
    terminalOutput: string
    t: (key: string) => string
    onExecute: (cmd: string) => void
    selectedConnectionId: string | null
}

export const SSHTerminal: React.FC<SSHTerminalProps> = ({
    terminalOutput,
    t,
    onExecute,
    selectedConnectionId
}) => {
    const quickActions = [
        { id: 'restart-service', label: t('ssh.quickActionRestartService'), command: 'sudo systemctl restart nginx' },
        { id: 'tail-logs', label: t('ssh.quickActionTailLogs'), command: 'tail -n 200 /var/log/syslog' },
        { id: 'run-tests', label: t('ssh.quickActionRunTests'), command: 'npm test' },
    ];

    return (
        <div className="flex h-full p-4 flex-col bg-background">
            <div className={C_SSHTERMINAL_1}>
                {terminalOutput !== '' ? terminalOutput : t('ssh.terminalOutput')}
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
                {quickActions.map(action => (
                    <button
                        key={action.id}
                        className="secondary-btn typo-caption"
                        onClick={() => {
                            if (selectedConnectionId) {
                                onExecute(action.command);
                            }
                        }}
                    >
                        {action.label}
                    </button>
                ))}
            </div>
            <div className="flex gap-2">
                <input
                    type="text"
                    placeholder={t('ssh.runCommand')}
                    className="flex-1 p-2 bg-muted border-none text-foreground text-sm rounded outline-none"
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            const target = e.target as HTMLInputElement;
                            if (selectedConnectionId) {
                                onExecute(target.value);
                                target.value = '';
                            }
                        }
                    }}
                />
            </div>
        </div>
    );
};
