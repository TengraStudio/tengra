
import React from 'react';

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
    return (
        <div className="flex h-full p-4 flex-col bg-background">
            <div className="flex-1 bg-background rounded-lg p-3 font-mono text-[11px] overflow-y-auto whitespace-pre-wrap mb-3 border border-border/30 text-[#0f0]">
                {terminalOutput !== '' ? terminalOutput : t('ssh.terminalOutput')}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
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
