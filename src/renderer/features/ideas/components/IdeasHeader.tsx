import { ArrowLeft, Download, History, Lightbulb, Plus, RefreshCw } from 'lucide-react';
import React, { useState } from 'react';

import { WorkflowStage } from '../types';

interface IdeasHeaderProps {
    workflowStage: WorkflowStage
    handleNewSession: () => void
    handleShowHistory: () => void
    loadSessions: () => Promise<void>
    hasIdeas?: boolean
    onExport?: (format: 'markdown' | 'json') => void
    t: (key: string) => string
}

const BackButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
    <button
        type="button"
        onClick={onClick}
        className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground"
        title="Back to Setup"
    >
        <ArrowLeft className="w-5 h-5" />
    </button>
);

const HistoryButton: React.FC<{ onClick: () => void; label: string }> = ({ onClick, label }) => (
    <button
        type="button"
        onClick={onClick}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted/30 hover:bg-muted/50 text-foreground/80 hover:text-foreground transition-colors"
    >
        <History className="w-4 h-4" />
        {label}
    </button>
);

const NewSessionButton: React.FC<{ onClick: () => void; label: string }> = ({ onClick, label }) => (
    <button
        type="button"
        onClick={onClick}
        className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg shadow-primary/20"
    >
        <Plus className="w-4 h-4" />
        {label}
    </button>
);

const RefreshButton: React.FC<{ onClick: () => void; label: string }> = ({ onClick, label }) => (
    <button
        type="button"
        onClick={onClick}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted/30 hover:bg-muted/50 text-foreground/80 hover:text-foreground transition-colors"
    >
        <RefreshCw className="w-4 h-4" />
        {label}
    </button>
);

const ExportButton: React.FC<{ onExport: (format: 'markdown' | 'json') => void; t: (key: string) => string }> = ({ onExport, t }) => {
    const [showMenu, setShowMenu] = useState(false);

    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => { setShowMenu(!showMenu); }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted/30 hover:bg-muted/50 text-foreground/80 hover:text-foreground transition-colors"
            >
                <Download className="w-4 h-4" />
                {t('ideas.export.button')}
            </button>
            {showMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-background border border-border rounded-lg shadow-lg overflow-hidden z-10">
                    <button
                        onClick={() => {
                            onExport('markdown');
                            setShowMenu(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-muted/50 text-foreground transition-colors"
                    >
                        {t('ideas.export.markdown')}
                    </button>
                    <button
                        onClick={() => {
                            onExport('json');
                            setShowMenu(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-muted/50 text-foreground transition-colors"
                    >
                        {t('ideas.export.json')}
                    </button>
                </div>
            )}
        </div>
    );
};

const HeaderActions: React.FC<{
    workflowStage: WorkflowStage
    handleNewSession: () => void
    handleShowHistory: () => void
    loadSessions: () => Promise<void>
    hasIdeas?: boolean
    onExport?: (format: 'markdown' | 'json') => void
    t: (key: string) => string
}> = ({ workflowStage, handleNewSession, handleShowHistory, loadSessions, hasIdeas, onExport, t }) => {
    const showHistoryButton = workflowStage === 'setup' || workflowStage === 'review';
    const showNewSessionButton = workflowStage === 'history' || workflowStage === 'review';
    const showRefreshButton = workflowStage === 'review';
    const showExportButton = workflowStage === 'review' && hasIdeas && onExport;

    return (
        <div className="flex items-center gap-2">
            {showHistoryButton && workflowStage === 'setup' && (
                <HistoryButton onClick={handleShowHistory} label={t('ideas.history.view')} />
            )}
            {showExportButton && (
                <ExportButton onExport={onExport} t={t} />
            )}
            {showNewSessionButton && (
                <NewSessionButton onClick={handleNewSession} label={t('ideas.newSession')} />
            )}
            {showRefreshButton && (
                <RefreshButton onClick={() => void loadSessions()} label={t('common.refresh')} />
            )}
            {showHistoryButton && workflowStage === 'review' && (
                <HistoryButton onClick={handleShowHistory} label={t('ideas.history.view')} />
            )}
        </div>
    );
};

export const IdeasHeader: React.FC<IdeasHeaderProps> = ({
    workflowStage,
    handleNewSession,
    handleShowHistory,
    loadSessions,
    hasIdeas,
    onExport,
    t
}) => {
    const showBackButton = workflowStage !== 'setup';
    const isHistoryView = workflowStage === 'history';

    return (
        <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
                {showBackButton && <BackButton onClick={handleNewSession} />}
                <div>
                    <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
                        <Lightbulb className="w-7 h-7 text-warning" />
                        {isHistoryView ? t('ideas.history.title') : t('ideas.title')}
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        {isHistoryView ? t('ideas.history.subtitle') : t('ideas.subtitle')}
                    </p>
                </div>
            </div>

            <HeaderActions
                workflowStage={workflowStage}
                handleNewSession={handleNewSession}
                handleShowHistory={handleShowHistory}
                loadSessions={loadSessions}
                hasIdeas={hasIdeas}
                onExport={onExport}
                t={t}
            />
        </div>
    );
};
