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

import { LoadingSpinner } from '@/components/lazy';
import { Language } from '@/i18n';
import { cn } from '@/lib/utils';
import { Workspace } from '@/types';

const AIAssistantSidebar = React.lazy(() =>
    import('@/features/workspace/workspace-agent/AIAssistantSidebar').then(m => ({
        default: m.AIAssistantSidebar,
    }))
);

interface WorkspaceSidebarProps {
    workspace: Workspace;
    showAgentPanel: boolean;
    agentPanelWidth: number;
    setAgentPanelWidth: (_w: number) => void;
    t: (key: string) => string;
    language: Language;
    onSourceClick: (path: string) => void;
}

export const WorkspaceSidebar: React.FC<WorkspaceSidebarProps> = ({
    workspace,
    showAgentPanel,
    agentPanelWidth,
    setAgentPanelWidth: _setAgentPanelWidth,
    t,
    language,
    onSourceClick,
}) => {
    const [hasActivatedAgentPanel, setHasActivatedAgentPanel] = React.useState(showAgentPanel);

    React.useEffect(() => {
        if (!showAgentPanel) {
            return;
        }
        const timer = window.setTimeout(() => {
            setHasActivatedAgentPanel(true);
        }, 0);
        return () => window.clearTimeout(timer);
    }, [showAgentPanel]);

    return (
        <div
            className={cn(
                'border-l border-border/30 bg-background shrink-0 transition-all duration-300 overflow-hidden',
                showAgentPanel ? 'opacity-100' : 'w-0 opacity-0'
            )}
            style={{ width: showAgentPanel ? agentPanelWidth : 0 }}
        >
            {hasActivatedAgentPanel && (
                <React.Suspense
                    fallback={
                        <div className="flex h-full items-center justify-center">
                            <LoadingSpinner message={t('common.loading')} />
                        </div>
                    }
                >
                    <div className="h-full flex flex-col">
                        <AIAssistantSidebar
                            workspace={workspace}
                            t={t}
                            language={language}
                            onSourceClick={onSourceClick}
                        />
                    </div>
                </React.Suspense>
            )}
        </div>
    );
};
