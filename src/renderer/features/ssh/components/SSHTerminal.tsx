
import React from 'react'

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
            <div style={{
                flex: 1,
                backgroundColor: 'var(--terminal-bg, #000)',
                color: 'var(--terminal-fg, #0f0)',
                fontFamily: 'monospace',
                padding: '10px',
                borderRadius: '4px',
                overflowY: 'auto',
                whiteSpace: 'pre-wrap',
                marginBottom: '10px'
            }}>
                {terminalOutput || t('ssh.terminalOutput')}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
                <input
                    type="text"
                    placeholder={t('ssh.runCommand')}
                    className="flex-1 p-2 bg-muted border-none text-foreground text-sm rounded outline-none"
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            const target = e.target as HTMLInputElement
                            if (selectedConnectionId) {
                                onExecute(target.value)
                                target.value = ''
                            }
                        }
                    }}
                />
            </div>
        </div>
    )
}
