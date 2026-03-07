/**
 * Modal for viewing full idea details with approval workflow
 */
import { ProjectIdea } from '@shared/types/ideas';
import { Briefcase, Code2, Globe, Map, Sparkles, Target, Trash2, Users, X } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { appLogger } from '@/utils/renderer-logger';

import { getCategoryMeta } from '../utils/categories';

import { ApprovalFooter } from './ApprovalFooter';
import { IdeaDetailsContent } from './IdeaDetailsContent';

type TabId = 'overview' | 'market' | 'strategy' | 'technology' | 'roadmap' | 'users' | 'business';

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

interface SideNavProps {
    activeTab: TabId;
    setActiveTab: (tab: TabId) => void;
    ideaStatus: string;
}

interface IdeaHeaderProps {
    idea: ProjectIdea;
    selectedName: string;
    setSelectedName: (name: string) => void;
    onRegenerate?: () => Promise<void>;
    isRegenerating: boolean;
    onDelete: () => void;
    onClose: () => void;
    meta: {
        bgColor: string;
        color: string;
        icon: React.ElementType;
    };
}

interface RejectConfirmationProps {
    ideaTitle: string;
    rejectReason: string;
    setRejectReason: (reason: string) => void;
    onCancel: () => void;
    onConfirm: () => Promise<void>;
    isRejecting: boolean;
}

const SIDE_NAV_TABS: { id: TabId, labelKey: string, icon: React.ElementType }[] = [
    { id: 'overview', labelKey: 'ideas.details.tabs.overview', icon: Sparkles },
    { id: 'market', labelKey: 'ideas.details.tabs.market', icon: Globe },
    { id: 'strategy', labelKey: 'ideas.details.tabs.strategy', icon: Target },
    { id: 'users', labelKey: 'ideas.details.tabs.users', icon: Users },
    { id: 'business', labelKey: 'ideas.details.tabs.business', icon: Briefcase },
    { id: 'technology', labelKey: 'ideas.details.tabs.technology', icon: Code2 },
    { id: 'roadmap', labelKey: 'ideas.details.tabs.roadmap', icon: Map }
];

const SideNav: React.FC<SideNavProps> = ({ activeTab, setActiveTab, ideaStatus }) => {
    const { t } = useTranslation();
    const statusText = ideaStatus === 'pending'
        ? t('ideas.details.readyForPilot')
        : t('ideas.details.workspaceCreated');

    return (
        <div className="w-64 border-r border-border/50 p-4 flex flex-col gap-1 bg-muted/10">
            {SIDE_NAV_TABS.map((tab) => {
                const TabIcon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
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
                        {t(tab.labelKey)}
                        {isActive && (
                            <div className="ml-auto w-1 h-4 bg-primary rounded-full glow-primary" />
                        )}
                    </button>
                );
            })}

            <div className="mt-auto pt-4 border-t border-border/50">
                <div className="px-4 py-2 bg-gradient-to-br from-primary/10 to-accent/10 rounded-xl border border-primary/20">
                    <p className="text-xxs font-bold text-primary uppercase tracking-widest leading-relaxed">
                        {t('ideas.details.statusLabel')}
                    </p>
                    <p className="text-foreground font-bold text-sm mt-0.5">
                        {statusText}
                    </p>
                </div>
            </div>
        </div>
    );
};

const IdeaHeader: React.FC<IdeaHeaderProps> = ({ idea, selectedName, setSelectedName, onRegenerate, isRegenerating, onDelete, onClose, meta }) => {
    const { t } = useTranslation();
    const Icon = meta.icon;
    return (
        <div className="flex items-center gap-4 p-6 border-b border-border/50 shrink-0 bg-gradient-to-r from-primary/5 to-transparent">
            <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-lg', meta.bgColor, meta.color)}>
                <Icon className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                    <input
                        type="text"
                        value={selectedName}
                        onChange={(e) => setSelectedName(e.target.value)}
                        className="bg-transparent border-none p-0 text-2xl font-black text-foreground placeholder:text-muted-foreground/20 outline-none w-full max-w-md"
                        placeholder={t('ideas.details.workspaceNamePlaceholder')}
                    />
                    {selectedName !== idea.title && (
                        <button onClick={() => setSelectedName(idea.title)} className="text-xxs text-primary hover:text-primary/80 uppercase tracking-widest font-bold">
                            {t('common.reset')}
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
                        title={t('ideas.details.regenerateTitle')}
                    >
                        <Sparkles className={cn("w-4 h-4", isRegenerating && "animate-pulse")} />
                        {isRegenerating ? t('ideas.details.regenerating') : t('ideas.details.regenerate')}
                    </button>
                )}
                <button type="button" onClick={onDelete} className="p-2 rounded-lg hover:bg-destructive/10 text-destructive hover:text-destructive transition-colors group relative" title={t('ideas.details.deleteTitle')}>
                    <Trash2 className="w-5 h-5" />
                </button>
                <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-muted/30 text-muted-foreground hover:text-foreground transition-colors group relative" title={t('ideas.details.closeTitle')}>
                    <X className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
};

const RejectConfirmation: React.FC<RejectConfirmationProps> = ({ ideaTitle, rejectReason, setRejectReason, onCancel, onConfirm, isRejecting }) => {
    const { t } = useTranslation();
    return (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="bg-background border border-destructive/30 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
                <h3 className="text-lg font-bold text-foreground mb-2">{t('ideas.details.rejectTitle')}</h3>
                <p className="text-sm text-muted-foreground mb-4">
                    {t('ideas.details.rejectBody', { title: ideaTitle })}
                </p>
                <div className="mb-4">
                    <label className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider mb-2 block">
                        {t('ideas.details.rejectReasonLabel')}
                    </label>
                    <textarea
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder={t('ideas.details.rejectReasonPlaceholder')}
                        className="w-full px-3 py-2 bg-muted/20 border border-border/50 rounded-lg text-foreground placeholder-muted-foreground/30 focus:outline-none focus:border-destructive/50 transition-all text-sm resize-none"
                        rows={3}
                    />
                </div>
                <div className="flex gap-2 justify-end">
                    <button
                        onClick={onCancel}
                        disabled={isRejecting}
                        className="px-4 py-2 bg-muted/30 hover:bg-muted/50 text-foreground rounded-lg transition-colors text-sm font-medium"
                    >
                        {t('common.cancel')}
                    </button>
                    <button
                        onClick={() => { void onConfirm(); }}
                        disabled={isRejecting}
                        className="px-4 py-2 bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/20 rounded-lg transition-colors disabled:opacity-50 text-sm font-bold"
                    >
                        {isRejecting ? t('ideas.details.rejecting') : t('ideas.details.rejectAction')}
                    </button>
                </div>
            </div>
        </div>
    );
};

interface ModalKeyboardHandlerOptions {
    isApproving: boolean;
    isRejecting: boolean;
    showRejectConfirm: boolean;
    projectPath: string;
    selectedName: string;
    onClose: () => void;
    handleApprove: () => Promise<void>;
    handleRejectClick: () => void;
    handleRejectCancel: () => void;
}

function isUserTyping(target: Element): boolean {
    return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
}

interface EscapeKeyContext {
    showRejectConfirm: boolean;
    onClose: () => void;
    handleRejectCancel: () => void;
}

function handleEscapeKey(context: EscapeKeyContext): void {
    if (context.showRejectConfirm) {
        context.handleRejectCancel();
    } else {
        context.onClose();
    }
}

interface ControlKeyContext {
    key: string;
    projectPath: string;
    selectedName: string;
    showRejectConfirm: boolean;
    handleApprove: () => Promise<void>;
    handleRejectClick: () => void;
}

function handleControlKey(e: KeyboardEvent, context: ControlKeyContext): void {
    if (context.key === 'Enter' && context.projectPath && context.selectedName) {
        e.preventDefault();
        void context.handleApprove();
    } else if (context.key === 'Backspace' && !context.showRejectConfirm) {
        e.preventDefault();
        context.handleRejectClick();
    }
}

function useModalKeyboardHandler(options: ModalKeyboardHandlerOptions): void {
    const {
        isApproving, isRejecting, showRejectConfirm, projectPath, selectedName,
        onClose, handleApprove, handleRejectClick, handleRejectCancel
    } = options;
    
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent): void => {
            if (isApproving || isRejecting) { return; }
            const target = e.target as HTMLElement;

            if (e.key === 'Escape' && !isUserTyping(target)) {
                handleEscapeKey({ showRejectConfirm, onClose, handleRejectCancel });
                return;
            }

            if (!e.ctrlKey) { return; }

            handleControlKey(e, {
                key: e.key,
                projectPath,
                selectedName,
                showRejectConfirm,
                handleApprove,
                handleRejectClick
            });
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [projectPath, selectedName, isApproving, isRejecting, showRejectConfirm, onClose, handleApprove, handleRejectClick, handleRejectCancel]);
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
    const [selectedDescription, setSelectedDescription] = useState(idea.description || '');
    const [activeTab, setActiveTab] = useState<TabId>('overview');
    const [showLogoGenerator, setShowLogoGenerator] = useState(false);
    const [showRejectConfirm, setShowRejectConfirm] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const meta = getCategoryMeta(idea.category);

    const handleSelectFolder = async () => {
        try {
            const result = await window.electron.selectDirectory();
            if (result.success && result.path) {
                setProjectPath(result.path);
            }
        } catch (err) {
            if (err instanceof Error) {
                appLogger.warn('IdeaDetailsModal', `Folder selection failed: ${err.message}`);
            }
        }
    };

    const handleApprove = useCallback(async () => {
        if (!projectPath || !selectedName) { return; }
        await onApprove(projectPath, selectedName);
    }, [projectPath, selectedName, onApprove]);

    const handleRejectClick = useCallback(() => { setShowRejectConfirm(true); }, []);

    const handleRejectConfirm = async () => {
        await onReject();
        setShowRejectConfirm(false);
        setRejectReason('');
    };

    const handleRejectCancel = useCallback(() => {
        setShowRejectConfirm(false);
        setRejectReason('');
    }, []);

    useModalKeyboardHandler({
        isApproving,
        isRejecting,
        showRejectConfirm,
        projectPath,
        selectedName,
        onClose,
        handleApprove,
        handleRejectClick,
        handleRejectCancel
    });

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" onClick={onClose} />

            <div className="relative w-full max-w-5xl max-h-[90vh] overflow-hidden bg-background/95 backdrop-blur-xl border border-border/50 rounded-2xl flex flex-col shadow-2xl shadow-primary/10">
                <IdeaHeader
                    idea={idea}
                    selectedName={selectedName}
                    setSelectedName={setSelectedName}
                    onRegenerate={onRegenerate}
                    isRegenerating={isRegenerating}
                    onDelete={onDelete}
                    onClose={onClose}
                    meta={meta}
                />

                <div className="flex-1 overflow-hidden flex">
                    <SideNav activeTab={activeTab} setActiveTab={setActiveTab} ideaStatus={idea.status} />
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

            {showRejectConfirm && (
                <RejectConfirmation
                    ideaTitle={idea.title}
                    rejectReason={rejectReason}
                    setRejectReason={setRejectReason}
                    onCancel={handleRejectCancel}
                    onConfirm={handleRejectConfirm}
                    isRejecting={isRejecting}
                />
            )}
        </div>
    );
};
