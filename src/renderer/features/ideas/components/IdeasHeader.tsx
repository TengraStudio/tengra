import { ArrowLeft, History, Lightbulb, Plus, RefreshCw } from 'lucide-react'
import React from 'react'

import { WorkflowStage } from '../types'

interface IdeasHeaderProps {
    workflowStage: WorkflowStage
    handleNewSession: () => void
    handleShowHistory: () => void
    loadSessions: () => Promise<void>
    t: (key: string) => string
}

const BackButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
    <button
        type="button"
        onClick={onClick}
        className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white"
        title="Back to Setup"
    >
        <ArrowLeft className="w-5 h-5" />
    </button>
)

const HistoryButton: React.FC<{ onClick: () => void; label: string }> = ({ onClick, label }) => (
    <button
        type="button"
        onClick={onClick}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors"
    >
        <History className="w-4 h-4" />
        {label}
    </button>
)

const NewSessionButton: React.FC<{ onClick: () => void; label: string }> = ({ onClick, label }) => (
    <button
        type="button"
        onClick={onClick}
        className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors bg-purple-500 hover:bg-purple-600 text-white"
    >
        <Plus className="w-4 h-4" />
        {label}
    </button>
)

const RefreshButton: React.FC<{ onClick: () => void; label: string }> = ({ onClick, label }) => (
    <button
        type="button"
        onClick={onClick}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors"
    >
        <RefreshCw className="w-4 h-4" />
        {label}
    </button>
)

const HeaderActions: React.FC<{
    workflowStage: WorkflowStage
    handleNewSession: () => void
    handleShowHistory: () => void
    loadSessions: () => Promise<void>
    t: (key: string) => string
}> = ({ workflowStage, handleNewSession, handleShowHistory, loadSessions, t }) => {
    const showHistoryButton = workflowStage === 'setup' || workflowStage === 'review'
    const showNewSessionButton = workflowStage === 'history' || workflowStage === 'review'
    const showRefreshButton = workflowStage === 'review'

    return (
        <div className="flex items-center gap-2">
            {showHistoryButton && workflowStage === 'setup' && (
                <HistoryButton onClick={handleShowHistory} label={t('ideas.history.view')} />
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
    )
}

export const IdeasHeader: React.FC<IdeasHeaderProps> = ({
    workflowStage,
    handleNewSession,
    handleShowHistory,
    loadSessions,
    t
}) => {
    const showBackButton = workflowStage !== 'setup'
    const isHistoryView = workflowStage === 'history'

    return (
        <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
                {showBackButton && <BackButton onClick={handleNewSession} />}
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                        <Lightbulb className="w-7 h-7 text-yellow-400" />
                        {isHistoryView ? t('ideas.history.title') : t('ideas.title')}
                    </h1>
                    <p className="text-white/50 mt-1">
                        {isHistoryView ? t('ideas.history.subtitle') : t('ideas.subtitle')}
                    </p>
                </div>
            </div>

            <HeaderActions
                workflowStage={workflowStage}
                handleNewSession={handleNewSession}
                handleShowHistory={handleShowHistory}
                loadSessions={loadSessions}
                t={t}
            />
        </div>
    )
}
