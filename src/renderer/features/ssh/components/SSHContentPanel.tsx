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

import { NginxWizard } from '@/features/ssh/NginxWizard';
import { PackageManager } from '@/features/ssh/PackageManager';
import { SFTPBrowser } from '@/features/ssh/SFTPBrowser';
import { SSHLogs } from '@/features/ssh/SSHLogs';
import { StatsDashboard } from '@/features/ssh/StatsDashboard';
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

interface TabContentProps {
    connectionId: string;
    language: Language;
}

const TAB_COMPONENTS: Record<Exclude<TabId, 'terminal'>, React.FC<TabContentProps>> = {
    dashboard: ({ connectionId }) => <StatsDashboard connectionId={connectionId} />,
    packages: ({ connectionId }) => <PackageManager connectionId={connectionId} />,
    logs: ({ connectionId }) => <SSHLogs connectionId={connectionId} active />,
    management: ({ connectionId, language }) => <NginxWizard connectionId={connectionId} language={language} />,
    files: ({ connectionId }) => <SFTPBrowser connectionId={connectionId} />
};

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

    const renderContent = () => {
        if (activeTab === 'terminal') {
            return (
                <SSHTerminal
                    terminalOutput={terminalOutput}
                    t={t}
                    onExecute={onExecute}
                    selectedConnectionId={selectedConnectionId}
                />
            );
        }

        if (!selectedConnectionId) {return null;}

        const TabComponent = TAB_COMPONENTS[activeTab];
        return <TabComponent connectionId={selectedConnectionId} language={language} />;
    };

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
                    {renderContent()}
                </motion.div>
            </AnimatePresence>
        </div>
    );
}
