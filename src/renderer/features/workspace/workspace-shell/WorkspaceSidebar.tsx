import React from 'react';

import { LoadingSpinner } from '@/components/lazy';
import { Language } from '@/i18n';
import { Workspace } from '@/types';

const AIAssistantSidebar = React.lazy(() =>
    import('@renderer/features/workspace/workspace-agent/AIAssistantSidebar').then(m => ({
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
        if (showAgentPanel) {
            setHasActivatedAgentPanel(true);
        }
    }, [showAgentPanel]);

    return (
        <div
            className={`border-l border-border/30 bg-background/40 backdrop-blur-xl shrink-0 transition-all duration-300 relative ${showAgentPanel ? 'opacity-100' : 'w-0 opacity-0 overflow-hidden'
                }`}
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
