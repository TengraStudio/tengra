import { NginxWizard } from '@renderer/features/ssh/NginxWizard';
import { PackageManager } from '@renderer/features/ssh/PackageManager';
import { SFTPBrowser } from '@renderer/features/ssh/SFTPBrowser';
import { SSHLogs } from '@renderer/features/ssh/SSHLogs';
import { StatsDashboard } from '@renderer/features/ssh/StatsDashboard';

import { Language } from '@/i18n';
import { AnimatePresence, motion } from '@/lib/framer-motion-compat';

import { SSHTerminal } from './SSHTerminal';

export type TabId = 'terminal' | 'dashboard' | 'files' | 'packages' | 'logs' | 'management';

interface SSHContentPanelProps {
    activeTab: TabId
    selectedConnectionId: string | null
    terminalOutput: string
    onExecute: (cmd: string) => void
    t: (key: string) => string
    language: Language
}

export function SSHContentPanel({
    activeTab,
    selectedConnectionId,
    terminalOutput,
    onExecute,
    t,
    language
}: SSHContentPanelProps) {
    if (!selectedConnectionId && activeTab !== 'terminal') {
        return (
            <div className="flex-1 h-full flex items-center justify-center bg-background text-muted-foreground">
                {t('ssh.selectConnection')}
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-hidden relative">
            <AnimatePresence mode="wait">
                <motion.div
                    key={activeTab + (selectedConnectionId ?? '')}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="h-full w-full"
                >
                    {activeTab === 'terminal' ? (
                        <SSHTerminal
                            terminalOutput={terminalOutput}
                            t={t}
                            onExecute={onExecute}
                            selectedConnectionId={selectedConnectionId}
                        />
                    ) : activeTab === 'dashboard' && selectedConnectionId ? (
                        <StatsDashboard connectionId={selectedConnectionId} />
                    ) : activeTab === 'packages' && selectedConnectionId ? (
                        <PackageManager connectionId={selectedConnectionId} />
                    ) : activeTab === 'logs' && selectedConnectionId ? (
                        <SSHLogs connectionId={selectedConnectionId} active={activeTab === 'logs'} />
                    ) : activeTab === 'management' && selectedConnectionId ? (
                        <NginxWizard connectionId={selectedConnectionId} language={language} />
                    ) : selectedConnectionId ? (
                        <SFTPBrowser connectionId={selectedConnectionId} />
                    ) : null}
                </motion.div>
            </AnimatePresence>
        </div>
    );
}
