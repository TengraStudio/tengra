import { Archive, ArrowRight, Calendar, MoreVertical, Pencil, Terminal, Trash2 } from 'lucide-react';
import React, { createContext, memo, useContext, useEffect } from 'react';

import { motion } from '@/lib/framer-motion-compat';
import { cn } from '@/lib/utils';
import { Workspace } from '@/types';
import { appLogger } from '@/utils/renderer-logger';

interface WorkspaceCardSurfaceContextValue {
    activeMenuId: string | null
    setActiveMenuId: (id: string | null) => void
    onSelect: (workspace: Workspace) => void
    onEdit: (workspace: Workspace, e: React.MouseEvent) => void
    onDelete: (workspace: Workspace, e: React.MouseEvent) => void
    onArchive: (workspace: Workspace) => void
    t: (key: string) => string
}

const WorkspaceCardSurfaceContext = createContext<WorkspaceCardSurfaceContextValue | null>(null);
const SLOW_WORKSPACE_CARD_RENDER_THRESHOLD_MS = 10;
const MAX_ENTRANCE_ANIMATION_INDEX = 5;
const IS_RENDER_TELEMETRY_ENABLED = import.meta.env.DEV || import.meta.env.MODE === 'test';

function useWorkspaceCardSurfaceContext(): WorkspaceCardSurfaceContextValue {
    const context = useContext(WorkspaceCardSurfaceContext);
    if (!context) {
        throw new Error('WorkspaceCard must be used within WorkspaceCardSurfaceProvider');
    }
    return context;
}

export interface WorkspaceCardSurfaceProviderProps extends WorkspaceCardSurfaceContextValue {
    children: React.ReactNode
}

export const WorkspaceCardSurfaceProvider: React.FC<WorkspaceCardSurfaceProviderProps> = ({
    children,
    ...value
}) => (
    <WorkspaceCardSurfaceContext.Provider value={value}>
        {children}
    </WorkspaceCardSurfaceContext.Provider>
);

interface WorkspaceCardProps {
    workspace: Workspace
    index: number
    isSelected?: boolean
    onToggleSelection?: () => void
}

const WorkspaceSelectionCheckbox: React.FC<{ isSelected?: boolean; onToggle?: () => void }> = ({ isSelected, onToggle }) => {
    const { t } = useWorkspaceCardSurfaceContext();
    return (
    <button
        type="button"
        aria-label={t('common.select')}
        aria-pressed={Boolean(isSelected)}
        className={cn(
            "absolute top-3 left-3 z-10 transition-all duration-300",
            isSelected ? "opacity-100 scale-100" : "opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100"
        )}
        onClick={(e) => {
            e.stopPropagation();
            onToggle?.();
        }}
    >
        <div className={cn(
            "w-5 h-5 rounded border flex items-center justify-center transition-colors",
            isSelected ? "bg-primary border-primary text-primary-foreground" : "bg-background/80 border-border/60 hover:border-primary/50"
        )}>
            {isSelected && (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
            )}
        </div>
    </button>
    );
};

const WorkspaceCardMenu: React.FC<{ workspace: Workspace }> = ({ workspace }) => {
    const {
        activeMenuId,
        setActiveMenuId,
        onEdit,
        onDelete,
        onArchive,
        t
    } = useWorkspaceCardSurfaceContext();
    const showMenu = activeMenuId === workspace.id;

    return (
        <div className="relative">
        <button
            type="button"
            aria-label={t('common.more')}
            onClick={(e) => {
                e.stopPropagation();
                setActiveMenuId(showMenu ? null : workspace.id);
            }}
            className={cn(
                "p-1.5 rounded-md hover:bg-muted/30 text-muted-foreground hover:text-foreground transition-colors",
                showMenu ? "opacity-100 bg-muted/30 text-foreground" : "opacity-0 group-hover:opacity-100"
            )}
        >
            <MoreVertical className="w-4 h-4" />
        </button>

        {showMenu && (
            <>
                <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setActiveMenuId(null); }} />
                <div
                    className="absolute right-0 top-full mt-1 w-40 bg-card border border-border/50 rounded-lg shadow-xl z-50 py-1"
                    onClick={(e) => e.stopPropagation()}
                >
                    <button
                        type="button"
                        onClick={(e) => onEdit(workspace, e)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted/20 transition-colors text-left"
                    >
                        <Pencil className="w-3.5 h-3.5 text-primary" />
                        {t('common.edit')}
                    </button>
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onArchive(workspace); setActiveMenuId(null); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted/20 transition-colors text-left"
                    >
                        <Archive className="w-3.5 h-3.5 text-success" />
                        {workspace.status === 'archived'
                            ? t('common.unarchive')
                            : t('workspaces.archiveWorkspace')}
                    </button>
                    <button
                        type="button"
                        onClick={(e) => onDelete(workspace, e)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-destructive/10 text-destructive hover:bg-destructive/10 transition-colors text-left"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                        {t('common.delete')}
                    </button>
                </div>
            </>
        )}
    </div>
    );
};

const WorkspaceCardInfo: React.FC<{ workspace: Workspace }> = ({ workspace }) => (
    <div>
        <h3 className="font-semibold text-lg text-foreground group-hover:text-primary transition-colors truncate">
            {workspace.title}
        </h3>
        <p className="text-xs text-muted-foreground/60 truncate mt-1 font-mono">
            {workspace.path}
        </p>
    </div>
);

const WorkspaceCardFooter: React.FC<{ workspace: Workspace }> = ({ workspace }) => {
    const { t } = useWorkspaceCardSurfaceContext();
    return (
        <div className="pt-4 border-t border-border/40 mt-auto flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            {new Date(workspace.createdAt).toLocaleDateString()}
        </span>
        <span className={cn("px-2 py-0.5 rounded-full bg-muted/50 uppercase text-xxs font-bold tracking-wider", workspace.status === 'active' ? "text-success" : "")}>
            {workspace.status === 'active' ? t('common.active') : workspace.status}
        </span>
    </div>
    );
};

export const WorkspaceCard = memo<WorkspaceCardProps>(({
    workspace, index, isSelected, onToggleSelection
}) => {
    const { onSelect } = useWorkspaceCardSurfaceContext();
    const animationDelay = index <= MAX_ENTRANCE_ANIMATION_INDEX ? index * 0.02 : 0;

    useEffect(() => {
        if (!IS_RENDER_TELEMETRY_ENABLED) {
            return;
        }

        const renderStartMs = performance.now();
        const rafId = window.requestAnimationFrame(() => {
            const renderDurationMs = Math.round(performance.now() - renderStartMs);
            if (renderDurationMs >= SLOW_WORKSPACE_CARD_RENDER_THRESHOLD_MS) {
                appLogger.debug('WorkspaceCard', 'Slow workspace card render detected', {
                    workspaceId: workspace.id,
                    cardIndex: index,
                    renderDurationMs,
                    thresholdMs: SLOW_WORKSPACE_CARD_RENDER_THRESHOLD_MS
                });
            }
        });
        return () => window.cancelAnimationFrame(rafId);
    }, [index, workspace.id]);

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: animationDelay }}
            role="button"
            tabIndex={0}
            aria-label={workspace.title}
            onClick={() => onSelect(workspace)}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(workspace);
                }
            }}
            className={cn(
                "group bg-card border border-border/60 rounded-xl p-5 cursor-pointer transition-all hover:shadow-xl hover:shadow-black/5 flex flex-col gap-4 relative overflow-hidden",
                isSelected ? "border-primary/50 bg-primary/5" : "hover:border-foreground/20"
            )}
        >
            <WorkspaceSelectionCheckbox isSelected={isSelected} onToggle={onToggleSelection} />

            <div className="flex items-start justify-between">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary overflow-hidden shadow-inner border border-border/50 ml-6">
                    {workspace.logo ? (
                        <img src={`safe-file://${workspace.logo}`} alt={workspace.title} className="w-full h-full object-cover" />
                    ) : (
                        <Terminal className="w-5 h-5" />
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <ArrowRight className="w-5 h-5 text-muted-foreground -rotate-44 group-hover:rotate-0 transition-transform duration-300" />
                    </div>

                    <WorkspaceCardMenu workspace={workspace} />
                </div>
            </div>

            <WorkspaceCardInfo workspace={workspace} />
            <WorkspaceCardFooter workspace={workspace} />
        </motion.div>
    );
});

WorkspaceCard.displayName = 'WorkspaceCard';
