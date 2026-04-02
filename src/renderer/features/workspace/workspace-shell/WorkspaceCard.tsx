import {
    Button,
} from '@renderer/components/ui/button';
import { Checkbox } from '@renderer/components/ui/checkbox';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@renderer/components/ui/dropdown-menu';
import { motion } from '@renderer/lib/framer-motion-compat';
import { cn } from '@renderer/lib/utils';
import { appLogger } from '@renderer/utils/renderer-logger';
import {
    Archive,
    ArrowRight,
    Calendar,
    MoreVertical,
    Pencil,
    Terminal,
    Trash2,
} from 'lucide-react';
import React, { createContext, memo, useContext, useEffect } from 'react';

import { Workspace } from '@/types';
import { toSafeFileUrl } from '@/utils/safe-file-url.util';

interface WorkspaceCardSurfaceContextValue {
    activeMenuId: string | null
    setActiveMenuId: (id: string | null) => void
    onSelect: (workspace: Workspace) => void
    onEdit: (workspace: Workspace) => void
    onDelete: (workspace: Workspace) => void
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
        <div
            className={cn(
                "absolute top-3 left-3 z-10 transition-all duration-300",
                isSelected ? "opacity-100 scale-100" : "opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100"
            )}
        >
            <Checkbox
                checked={isSelected}
                onCheckedChange={() => onToggle?.()}
                aria-label={t('common.select')}
                className="w-5 h-5"
            />
        </div>
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
        <DropdownMenu open={showMenu} onOpenChange={(open) => setActiveMenuId(open ? workspace.id : null)}>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                        "h-8 w-8 rounded-md text-muted-foreground hover:text-foreground transition-colors",
                        showMenu ? "opacity-100 bg-muted/30 text-foreground" : "opacity-0 group-hover:opacity-100"
                    )}
                    onClick={(e) => e.stopPropagation()}
                >
                    <MoreVertical className="w-4 h-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={() => onEdit(workspace)}>
                    <Pencil className="mr-2 h-3.5 w-3.5 text-primary" />
                    <span>{t('common.edit')}</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onArchive(workspace); }}>
                    <Archive className="mr-2 h-3.5 w-3.5 text-success" />
                    <span>
                        {workspace.status === 'archived'
                            ? t('common.unarchive')
                            : t('workspaces.archiveWorkspace')}
                    </span>
                </DropdownMenuItem>
                <DropdownMenuItem 
                    className="text-destructive focus:text-destructive"
                    onClick={() => onDelete(workspace)}
                >
                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                    <span>{t('common.delete')}</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
};

const WorkspaceCardInfo: React.FC<{ workspace: Workspace }> = ({ workspace }) => (
    <div className="flex-1 min-w-0">
        <h3 className="text-base font-bold text-foreground truncate">
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
            <span className={cn("px-2 py-0.5 rounded-full bg-muted/50  text-xxs font-bold ", workspace.status === 'active' ? "text-success" : "")}>
                {workspace.status === 'active' ? t('common.active') : workspace.status}
            </span>
        </div>
    );
};

const WorkspaceLogo: React.FC<{ workspace: Workspace }> = ({ workspace }) => {
    const baseLogoUrl = toSafeFileUrl(workspace.logo);
    const logoUrl = baseLogoUrl ? `${baseLogoUrl}?v=${workspace.updatedAt}` : null;
    if (!logoUrl) {
        return <Terminal className="w-5 h-5" />;
    }

    return <img src={logoUrl} alt={workspace.title} className="w-full h-full object-cover" />;
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
                    <WorkspaceLogo workspace={workspace} />
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
