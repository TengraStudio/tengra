/**
 * Modal for viewing full idea details with approval workflow
 */
import { ProjectIdea } from '@shared/types/ideas';
import { Briefcase, Code2, Globe, Map, Sparkles, Target, Trash2, Users, X } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

import { getCategoryMeta } from '../utils/categories';

import { ApprovalFooter } from './ApprovalFooter';
import { IdeaDetailsContent } from './IdeaDetailsContent';

interface IdeaDetailsModalProps {
    idea: ProjectIdea
    onClose: () => void
    onApprove: (projectPath: string, selectedName?: string) => Promise<void>
    onReject: () => Promise<void>
    onArchive?: () => Promise<void>
    onDelete: () => void
    onRegenerate?: () => Promise<void>
    isApproving: boolean
    isRejecting: boolean
    isArchiving?: boolean
    isRegenerating?: boolean
    canGenerateLogo: boolean
}

export const IdeaDetailsModal: React.FC<IdeaDetailsModalProps> = ({
    idea,
    onClose,
    onApprove,
    onReject,
    onArchive,
    onDelete,
    onRegenerate,
    isApproving,
    isRejecting,
    isArchiving = false,
    isRegenerating = false,
    canGenerateLogo
}) => {
    const [projectPath, setProjectPath] = useState('');
    const [selectedName, setSelectedName] = useState(idea.title);
    const [selectedDescription, setSelectedDescription] = useState(idea.description);
    const [activeTab, setActiveTab] = useState<'overview' | 'market' | 'strategy' | 'technology' | 'roadmap' | 'users' | 'business'>('overview');
    const [showLogoGenerator, setShowLogoGenerator] = useState(false);
    const [showRejectConfirm, setShowRejectConfirm] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const meta = getCategoryMeta(idea.category);
    const Icon = meta.icon;

    const handleSelectFolder = async () => {
        try {
            const result = await window.electron.selectDirectory();
            if (result.success && result.path) {
                setProjectPath(result.path);
            }
        } catch (err) {
            // Log error for debugging - user sees no folder selected
            if (err instanceof Error) {
                console.warn('Folder selection failed:', err.message);
            }
        }
    };

    const handleApprove = useCallback(async () => {
        if (!projectPath || !selectedName) {
            return;
        }
        await onApprove(projectPath, selectedName);
    }, [projectPath, selectedName, onApprove]);

    const handleRejectClick = () => {
        setShowRejectConfirm(true);
    };

    const handleRejectConfirm = async () => {
        await onReject();
        setShowRejectConfirm(false);
        setRejectReason('');
    };

    const handleRejectCancel = () => {
        setShowRejectConfirm(false);
        setRejectReason('');
    };

    // Keyboard shortcuts: Escape to close, Ctrl+Enter to approve (when ready), Ctrl+Backspace to reject
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Escape to close (unless user is typing in input field)
            if (e.key === 'Escape' && !isApproving && !isRejecting) {
                const target = e.target as HTMLElement;
                if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
                    if (showRejectConfirm) {
                        handleRejectCancel();
                    } else {
                        onClose();
                    }
                }
            }

            // Ctrl+Enter to approve (when folder selected)
            if (e.key === 'Enter' && e.ctrlKey && projectPath && selectedName && !isApproving && !isRejecting) {
                e.preventDefault();
                void handleApprove();
            }

            // Ctrl+Backspace to show reject confirmation
            if (e.key === 'Backspace' && e.ctrlKey && !isApproving && !isRejecting && !showRejectConfirm) {
                e.preventDefault();
                handleRejectClick();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [projectPath, selectedName, isApproving, isRejecting, showRejectConfirm, onClose, handleApprove]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" onClick={onClose} />

            <div className="relative w-full max-w-5xl max-h-[90vh] overflow-hidden bg-background/95 backdrop-blur-xl border border-border/50 rounded-2xl flex flex-col shadow-2xl shadow-primary/10">
                {/* Header Section */}
                <div className="flex items-center gap-4 p-6 border-b border-border/50 shrink-0 bg-gradient-to-r from-primary/5 to-transparent">
                    <div
                        className={cn(
                            'w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-lg',
                            meta.bgColor,
                            meta.color
                        )}
                    >
                        <Icon className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                            <input
                                type="text"
                                value={selectedName}
                                onChange={(e) => setSelectedName(e.target.value)}
                                className="bg-transparent border-none p-0 text-2xl font-black text-foreground placeholder:text-muted-foreground/20 focus:ring-0 outline-none w-full max-w-md"
                                placeholder="Project Name"
                            />
                            {selectedName !== idea.title && (
                                <button
                                    onClick={() => setSelectedName(idea.title)}
                                    className="text-[10px] text-primary hover:text-primary/80 uppercase tracking-widest font-bold"
                                >
                                    Reset
                                </button>
                            )}
                        </div>
                        <p className="text-muted-foreground/60 text-xs font-medium uppercase tracking-[0.15em] mt-1 flex items-center gap-2">
                            {idea.category} • {new Date(idea.createdAt).toLocaleDateString()}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        {idea.status === 'pending' && onRegenerate && (
                            <button
                                type="button"
                                onClick={() => void onRegenerate()}
                                disabled={isRegenerating}
                                className="px-3 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-medium"
                                title="Regenerate this idea"
                            >
                                <Sparkles className={cn("w-4 h-4", isRegenerating && "animate-pulse")} />
                                {isRegenerating ? 'Regenerating...' : 'Regenerate'}
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={onDelete}
                            className="p-2 rounded-lg hover:bg-destructive/10 text-destructive hover:text-destructive transition-colors group relative"
                            title="Delete Idea"
                        >
                            <Trash2 className="w-5 h-5" />
                            <kbd className="hidden group-hover:inline-block absolute -bottom-6 right-0 px-1.5 py-0.5 text-[10px] bg-destructive/20 text-destructive rounded font-mono shadow-lg whitespace-nowrap">Delete</kbd>
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 rounded-lg hover:bg-muted/30 text-muted-foreground hover:text-foreground transition-colors group relative"
                            title="Close (Esc)"
                        >
                            <X className="w-5 h-5" />
                            <kbd className="hidden group-hover:inline-block absolute -bottom-6 right-0 px-1.5 py-0.5 text-[10px] bg-muted/80 text-foreground rounded font-mono shadow-lg">Esc</kbd>
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-hidden flex">
                    {/* Side Navigation */}
                    <div className="w-64 border-r border-border/50 p-4 flex flex-col gap-1 bg-muted/10">
                        {[
                            { id: 'overview', label: 'Overview', icon: Sparkles },
                            { id: 'market', label: 'Market Analysis', icon: Globe },
                            { id: 'strategy', label: 'Strategy', icon: Target },
                            { id: 'users', label: 'User Profiles', icon: Users },
                            { id: 'business', label: 'Business Case', icon: Briefcase },
                            { id: 'technology', label: 'Technology', icon: Code2 },
                            { id: 'roadmap', label: 'Roadmap', icon: Map }
                        ].map((tab) => {
                            const TabIcon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as typeof activeTab)}
                                    className={cn(
                                        'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all group',
                                        isActive
                                            ? 'bg-primary/10 text-primary'
                                            : 'text-muted-foreground/60 hover:text-foreground hover:bg-muted/30'
                                    )}
                                >
                                    <TabIcon className={cn(
                                        'w-4 h-4 transition-colors',
                                        isActive ? 'text-primary' : 'text-muted-foreground/30 group-hover:text-muted-foreground/50'
                                    )} />
                                    {tab.label}
                                    {isActive && (
                                        <div className="ml-auto w-1 h-4 bg-primary rounded-full shadow-[0_0_8px_rgba(var(--primary),0.5)]" />
                                    )}
                                </button>
                            );
                        })}

                        <div className="mt-auto pt-4 border-t border-border/50">
                            <div className="px-4 py-2 bg-gradient-to-br from-primary/10 to-accent/10 rounded-xl border border-primary/20">
                                <p className="text-[10px] font-bold text-primary uppercase tracking-widest leading-relaxed">
                                    Status
                                </p>
                                <p className="text-foreground font-bold text-sm mt-0.5">
                                    {idea.status === 'pending' ? 'Ready for Pilot' : 'Project Created'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 overflow-hidden flex flex-col bg-gradient-to-b from-muted/5 to-transparent">
                        <IdeaDetailsContent
                            idea={idea}
                            activeTab={activeTab}
                            selectedName={selectedName}
                            onNameSelect={setSelectedName}
                            selectedDescription={selectedDescription}
                            onDescriptionChange={setSelectedDescription}
                            canGenerateLogo={canGenerateLogo}
                            showLogoGenerator={showLogoGenerator}
                            setShowLogoGenerator={setShowLogoGenerator}
                        />
                    </div>
                </div>

                {idea.status === 'pending' && (
                    <ApprovalFooter
                        projectPath={projectPath}
                        setProjectPath={setProjectPath}
                        handleSelectFolder={handleSelectFolder}
                        onReject={async () => handleRejectClick()}
                        onArchive={onArchive}
                        handleApprove={handleApprove}
                        isApproving={isApproving}
                        isRejecting={isRejecting}
                        isArchiving={isArchiving}
                    />
                )}
            </div>

            {/* Rejection Confirmation Modal */}
            {showRejectConfirm && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm">
                    <div className="bg-background border border-destructive/30 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
                        <h3 className="text-lg font-bold text-foreground mb-2">Reject this idea?</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                            Are you sure you want to reject "{idea.title}"? This action cannot be undone.
                        </p>
                        <div className="mb-4">
                            <label className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider mb-2 block">
                                Reason (Optional)
                            </label>
                            <textarea
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                placeholder="Why are you rejecting this idea?"
                                className="w-full px-3 py-2 bg-muted/20 border border-border/50 rounded-lg text-foreground placeholder-muted-foreground/30 focus:outline-none focus:border-destructive/50 transition-all text-sm resize-none"
                                rows={3}
                            />
                        </div>
                        <div className="flex gap-2 justify-end">
                            <button
                                onClick={handleRejectCancel}
                                disabled={isRejecting}
                                className="px-4 py-2 bg-muted/30 hover:bg-muted/50 text-foreground rounded-lg transition-colors text-sm font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => void handleRejectConfirm()}
                                disabled={isRejecting}
                                className="px-4 py-2 bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/20 rounded-lg transition-colors disabled:opacity-50 text-sm font-bold"
                            >
                                {isRejecting ? 'Rejecting...' : 'Reject Idea'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
