/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

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

/* Batch-02: Extracted Long Classes */
const C_WORKSPACECARD_1 = "w-12 h-12 rounded-xl bg-muted flex items-center justify-center text-muted-foreground overflow-hidden shadow-inner border border-border/50";

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
                "absolute top-3 left-3 z-30 transition-all duration-300",
                isSelected ? "opacity-100 scale-100" : "opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100"
            )}
            onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
            }}
            onMouseDown={(e) => {
                e.stopPropagation();
            }}
        >
            <Checkbox
                checked={isSelected}
                onCheckedChange={(checked) => {
                    if (checked !== isSelected) {
                        onToggle?.();
                    }
                }}
                aria-label={t('common.select')}
                className="w-5 h-5 border-border/60 data-[state=checked]:bg-primary data-[state=checked]:border-primary transition-all"
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
                        "h-8 w-8 rounded-md text-muted-foreground hover:text-foreground transition-all hover:bg-muted/80 active:scale-95",
                        showMenu ? "opacity-100 bg-muted text-foreground" : "opacity-0 group-hover:opacity-100"
                    )}
                    onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                    }}
                >
                    <MoreVertical className="w-4 h-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40 border-border/40 shadow-xl">
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
    <div className="flex-1 min-w-0 space-y-1">
        <h3 className="text-lg font-bold text-foreground truncate tracking-tight">
            {workspace.title}
        </h3>
        <p className="text-11 text-muted-foreground/40 whitespace-pre font-mono bg-muted/20 px-2 py-0.5 rounded-md inline-block max-w-full overflow-hidden text-ellipsis">
            {workspace.path}
        </p>
    </div>
);

const WorkspaceCardFooter: React.FC<{ workspace: Workspace }> = ({ workspace }) => {
    const { t } = useWorkspaceCardSurfaceContext();
    const statusTranslationKey: Record<Workspace['status'], string> = {
        active: 'workspaces.statusActive',
        archived: 'workspaces.statusArchived',
        draft: 'workspaces.statusDraft'
    };
    
    // Default workspaces don't need an 'Active' badge as it's clear they are current
    const showStatus = workspace.status !== 'active';

    return (
        <div className="pt-4 border-t border-border/20 mt-auto flex items-center justify-between text-11 text-muted-foreground/50">
            <span className="flex items-center gap-1.5 font-medium">
                <Calendar className="w-3.5 h-3.5" />
                {new Date(workspace.createdAt).toLocaleDateString()}
            </span>
            {showStatus && (
                <div className="px-2 py-0.5 rounded-md text-10 font-bold uppercase tracking-wider bg-muted/50 border border-border/40 text-muted-foreground/80">
                    {t(statusTranslationKey[workspace.status])}
                </div>
            )}
        </div>
    );
};

const WorkspaceLogo: React.FC<{ workspace: Workspace; className?: string }> = ({ workspace, className }) => {
    const [error, setError] = React.useState(false);
    const baseLogoUrl = toSafeFileUrl(workspace.logo);
    const logoUrl = baseLogoUrl && !error ? (baseLogoUrl.startsWith('data:') ? baseLogoUrl : `${baseLogoUrl}?v=${workspace.updatedAt}`) : null;
    
    if (!logoUrl) {
        return <Terminal className={cn("w-5 h-5 text-muted-foreground/50", className)} />;
    }

    return (
        <img 
            src={logoUrl} 
            alt={workspace.title} 
            className={cn("w-full h-full object-cover", className)} 
            onError={() => setError(true)}
        />
    );
};

const WorkspaceBackgroundLogo: React.FC<{ workspace: Workspace }> = ({ workspace }) => {
    const [error, setError] = React.useState(false);
    const baseLogoUrl = toSafeFileUrl(workspace.logo);
    const logoUrl = baseLogoUrl && !error ? (baseLogoUrl.startsWith('data:') ? baseLogoUrl : `${baseLogoUrl}?v=${workspace.updatedAt}`) : null;
    
    if (!logoUrl) {
        return (
            <div className="absolute -right-4 -bottom-4 opacity-[0.02] text-foreground pointer-events-none select-none rotate-12 z-0">
                <Terminal size={140} strokeWidth={1} />
            </div>
        );
    }

    return (
        <img 
            src={logoUrl} 
            alt="" 
            className="absolute -right-8 -bottom-8 w-48 h-48 opacity-[0.04] grayscale brightness-0 invert pointer-events-none select-none rotate-12 z-0 object-contain transition-all duration-700 blur-[1px] group-hover:scale-110 group-hover:rotate-6" 
            onError={() => setError(true)}
        />
    );
};

const cardContainerClassName = 
    "group bg-card border border-border/40 rounded-xl p-5 cursor-pointer transition-all duration-300 hover:shadow-2xl hover:shadow-black/10 hover:border-primary/40 flex flex-col gap-5 relative overflow-hidden ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

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
            initial={{ opacity: 0, y: 15 }}
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
                cardContainerClassName,
                isSelected ? "border-primary/50 bg-primary/[0.03] shadow-inner" : ""
            )}
        >
            <WorkspaceBackgroundLogo workspace={workspace} />
            
            <WorkspaceSelectionCheckbox isSelected={isSelected} onToggle={onToggleSelection} />

            <div className="flex items-start justify-between relative z-10">
                <div className={C_WORKSPACECARD_1}>
                    <WorkspaceLogo workspace={workspace} />
                </div>

                <div className="flex items-center gap-2">
                    <div className="opacity-0 group-hover:opacity-100 translate-x-1 group-hover:translate-x-0 transition-all duration-300">
                        <ArrowRight className="w-5 h-5 text-muted-foreground/40" />
                    </div>

                    <WorkspaceCardMenu workspace={workspace} />
                </div>
            </div>

            <div className="relative z-10">
                <WorkspaceCardInfo workspace={workspace} />
            </div>
            
            <div className="relative z-10 mt-auto">
                <WorkspaceCardFooter workspace={workspace} />
            </div>
        </motion.div>
    );
});

WorkspaceCard.displayName = 'WorkspaceCard';
