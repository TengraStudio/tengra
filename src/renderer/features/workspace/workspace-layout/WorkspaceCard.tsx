/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconArchive, IconArrowRight, IconCalendar, IconDotsVertical, IconPencil, IconTerminal, IconTrash } from '@tabler/icons-react';
import React, { createContext, memo, useContext, useEffect } from 'react';

import {
    Button,
} from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { motion } from '@/lib/framer-motion-compat';
import { cn } from '@/lib/utils';
import { Workspace } from '@/types';
import { appLogger } from '@/utils/renderer-logger';
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
const IS_RENDER_usageStats_ENABLED = import.meta.env.DEV || import.meta.env.MODE === 'test';

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
                    <IconDotsVertical className="w-4 h-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40 border-border/40 shadow-xl">
                <DropdownMenuItem onClick={() => onEdit(workspace)}>
                    <IconPencil className="mr-2 h-3.5 w-3.5 text-primary" />
                    <span>{t('common.edit')}</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onArchive(workspace); }}>
                    <IconArchive className="mr-2 h-3.5 w-3.5 text-success" />
                    <span>
                        {workspace.status === 'archived'
                            ? t('common.unarchive')
                            : t('frontend.workspaces.archiveWorkspace')}
                    </span>
                </DropdownMenuItem>
                <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => onDelete(workspace)}
                >
                    <IconTrash className="mr-2 h-3.5 w-3.5" />
                    <span>{t('common.delete')}</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
};

const WorkspaceCardInfo: React.FC<{ workspace: Workspace }> = ({ workspace }) => (
    <div className="flex-1 min-w-0 space-y-1">
        <h3 className="text-base font-semibold text-foreground truncate ">
            {workspace.title}
        </h3>
        <p className="text-sm text-muted-foreground/30 whitespace-pre font-medium bg-muted/10 px-1.5 py-0.5 rounded transition-colors group-hover:bg-muted/20 group-hover:text-muted-foreground/50 truncate">
            {workspace.path}
        </p>
    </div>
);

const WorkspaceCardFooter: React.FC<{ workspace: Workspace }> = ({ workspace }) => {
    const { t } = useWorkspaceCardSurfaceContext();
    const statusTranslationKey: Record<Workspace['status'], string> = {
        active: 'frontend.workspaces.statusActive',
        archived: 'frontend.workspaces.statusArchived',
        draft: 'frontend.workspaces.statusDraft'
    };

    // Default workspaces don't need an 'Active' badge as it's clear they are current
    const showStatus = workspace.status !== 'active';

    return (
        <div className="pt-3 border-t border-border/5 mt-auto flex items-center justify-between text-sm font-medium text-muted-foreground/30">
            <span className="flex items-center gap-1.5">
                <IconCalendar className="w-3 h-3" />
                {new Date(workspace.createdAt).toLocaleDateString()}
            </span>
            {showStatus && (
                <div className="px-2 py-0.5 rounded bg-muted/30 text-muted-foreground/60">
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
        return <IconTerminal className={cn("w-5 h-5 text-muted-foreground/50", className)} />;
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
 
const cardContainerClassName =
    "group bg-card/30 border border-border/10 rounded-xl p-5 cursor-pointer transition-all duration-300 hover:bg-muted/30 hover:border-border/30 flex flex-col gap-5 relative overflow-hidden ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

export const WorkspaceCard = memo<WorkspaceCardProps>(({
    workspace, index, isSelected, onToggleSelection
}) => {
    const { onSelect } = useWorkspaceCardSurfaceContext();
    const animationDelay = index <= MAX_ENTRANCE_ANIMATION_INDEX ? index * 0.02 : 0;

    useEffect(() => {
        if (!IS_RENDER_usageStats_ENABLED) {
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
            <WorkspaceSelectionCheckbox isSelected={isSelected} onToggle={onToggleSelection} />

            <div className="flex items-start justify-between relative z-10">
                <div className="w-11 h-11 rounded-lg bg-muted/50 flex items-center justify-center text-muted-foreground/40 overflow-hidden border border-border/10">
                    <WorkspaceLogo workspace={workspace} />
                </div>

                <div className="flex items-center gap-2">
                    <div className="opacity-0 group-hover:opacity-100 translate-x-1 group-hover:translate-x-0 transition-all duration-300">
                        <IconArrowRight className="w-4 h-4 text-muted-foreground/30" />
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

