/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { safeJsonParse } from '@shared/utils/sanitize.util';
import { IconChevronDown, IconChevronRight } from '@tabler/icons-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { Tooltip } from '@/components/ui/tooltip';
import { AnimatePresence, motion } from '@/lib/framer-motion-compat';
import { cn } from '@/lib/utils';

/* Batch-02: Extracted Long Classes */
const C_SIDEBARSECTION_1 = "absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-sm font-bold flex items-center justify-center text-primary-foreground";


type BadgeVariant = 'default' | 'warning' | 'error' | 'success';

const BADGE_CLASSES: Record<BadgeVariant, string> = {
    default: 'bg-muted text-muted-foreground',
    warning: 'bg-warning/20 text-warning',
    error: 'bg-destructive/20 text-destructive',
    success: 'bg-success/20 text-success'
};

export interface SidebarSectionProps {
    /** Unique identifier for persistence */
    id: string
    /** Section title displayed in header */
    title: string
    /** Icon component to display before title */
    icon?: React.ReactNode
    /** Whether section starts expanded */
    defaultExpanded?: boolean
    /** Badge content (number or string) */
    badge?: number | string
    /** Badge variant for styling */
    badgeVariant?: BadgeVariant
    /** Called when expansion state changes */
    onExpandedChange?: (expanded: boolean) => void
    /** Whether to persist state to localStorage */
    persistState?: boolean
    /** Custom class name */
    className?: string
    /** Section content */
    children: React.ReactNode
    /** Collapsed sidebar mode - shows flyout instead */
    isCollapsed?: boolean
    /** Tooltip for collapsed mode */
    tooltip?: string
}

function getInitialExpandedState(persistState: boolean, storageKey: string, defaultExpanded: boolean): boolean {
    if (persistState && typeof window !== 'undefined') {
        const stored = localStorage.getItem(storageKey);
        return stored !== null ? safeJsonParse<boolean>(stored, defaultExpanded) : defaultExpanded;
    }
    return defaultExpanded;
}

export const SidebarSection: React.FC<SidebarSectionProps> = React.memo(({
    id,
    title,
    icon,
    defaultExpanded = true,
    badge,
    badgeVariant = 'default',
    onExpandedChange,
    persistState = true,
    className,
    children,
    isCollapsed = false,
    tooltip
}) => {
    const storageKey = `sidebar-section-${id}`;
    const [isExpanded, setIsExpanded] = useState(() => 
        getInitialExpandedState(persistState, storageKey, defaultExpanded)
    );

    useEffect(() => {
        if (persistState && typeof window !== 'undefined') {
            localStorage.setItem(storageKey, JSON.stringify(isExpanded));
        }
    }, [isExpanded, persistState, storageKey]);

    const toggleExpanded = useCallback(() => {
        setIsExpanded((prev: boolean) => {
            const newState = !prev;
            onExpandedChange?.(newState);
            return newState;
        });
    }, [onExpandedChange]);

    if (isCollapsed) {
        return <SidebarCollapsedSection icon={icon} tooltip={tooltip ?? title} badge={badge}>{children}</SidebarCollapsedSection>;
    }

    return (
        <div className={cn('sidebar-section', className)}>
            <SectionHeader id={id} title={title} icon={icon} badge={badge} badgeVariant={badgeVariant} isExpanded={isExpanded} onToggle={toggleExpanded} />
            <SectionContent isExpanded={isExpanded} id={id}>{children}</SectionContent>
        </div>
    );
}, (prev, next) => prev.id === next.id && prev.title === next.title && prev.isCollapsed === next.isCollapsed && prev.badge === next.badge && prev.badgeVariant === next.badgeVariant && prev.defaultExpanded === next.defaultExpanded && prev.className === next.className && (prev.children === next.children));

interface SectionHeaderProps {
    id: string
    title: string
    icon?: React.ReactNode
    badge?: number | string
    badgeVariant: SidebarSectionProps['badgeVariant']
    isExpanded: boolean
    onToggle: () => void
}

const SectionHeader: React.FC<SectionHeaderProps> = ({ id, title, icon, badge, badgeVariant, isExpanded, onToggle }) => (
    <button
        id={`section-header-${id}`}
        onClick={onToggle}
        className={cn(
            'sidebar-section-header w-full flex items-center justify-between',
            'px-3 py-2 mx-0.5 rounded-lg text-sm font-semibold ',
            'text-muted-foreground/70 hover:text-foreground hover:bg-background/40 hover:backdrop-blur-sm transition-all duration-200',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 group',
            isExpanded && 'text-foreground bg-background/20'
        )}
        aria-expanded={isExpanded}
    >
        <div className="flex items-center gap-2">
            <motion.div animate={{ rotate: isExpanded ? 0 : -90 }} transition={{ duration: 0.2, ease: "easeInOut" }} className={cn("bg-muted/50 rounded-sm p-0.5", isExpanded && "bg-transparent")}>
                <IconChevronDown className="w-2.5 h-2.5 opacity-70 group-hover:opacity-100" />
            </motion.div>
            {icon && <span className="opacity-70 group-hover:opacity-100 transition-opacity">{icon}</span>}
            <span>{title}</span>
        </div>
        {badge !== undefined && (
            <span className={cn('px-1.5 py-0.5 rounded-full text-sm font-medium border border-transparent', BADGE_CLASSES[badgeVariant ?? 'default'], "group-hover:border-border/20 group-hover:shadow-sm transition-all")}>{badge}</span>
        )}
    </button>
);

interface SectionContentProps {
    isExpanded: boolean
    id: string
    children: React.ReactNode
}

const SectionContent: React.FC<SectionContentProps> = ({ isExpanded, id, children }) => (
    <div className={cn("sidebar-section-content", isExpanded && "expanded")} aria-hidden={!isExpanded} aria-labelledby={`section-header-${id}`}>
        <div className="py-1 space-y-0.5">{children}</div>
    </div>
);

// Collapsed mode component with flyout
const SidebarCollapsedSection: React.FC<{
    icon: React.ReactNode
    tooltip: string
    badge?: number | string
    children: React.ReactNode
}> = React.memo(({ icon, tooltip, badge, children }) => {
    const [isOpen, setIsOpen] = useState(false);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const flyoutRef = useRef<HTMLDivElement>(null);

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                flyoutRef.current &&
                buttonRef.current &&
                !flyoutRef.current.contains(event.target as Node) &&
                !buttonRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
        return undefined;
    }, [isOpen]);

    return (
        <div className="relative">
            <Tooltip content={tooltip} side="right" disabled={isOpen}>
                <button
                    ref={buttonRef}
                    onClick={() => setIsOpen(!isOpen)}
                    className={cn(
                        'w-full p-3 flex items-center justify-center',
                        'rounded-lg transition-all duration-200',
                        'hover:bg-muted/10 text-muted-foreground hover:text-foreground',
                        isOpen && 'bg-muted/10 text-foreground'
                    )}
                    aria-label={tooltip}
                >
                    <div className="relative">
                        {icon}
                        {badge !== undefined && (
                            <span className={C_SIDEBARSECTION_1}>
                                {typeof badge === 'number' && badge > 9 ? '9+' : badge}
                            </span>
                        )}
                    </div>
                    <IconChevronRight className="w-3 h-3 ml-1 opacity-50" />
                </button>
            </Tooltip>

            {/* Flyout Menu */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        ref={flyoutRef}
                        initial={{ opacity: 0, x: -10, scale: 0.95 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: -10, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className={cn(
                            'absolute left-full top-0 ml-2 z-50',
                            'min-w-48 max-w-72',
                            'bg-popover border border-border rounded-xl shadow-xl',
                            'py-2'
                        )}
                    >
                        <div className="px-3 py-2 typo-caption font-semibold text-muted-foreground border-b border-border/50 mb-1">
                            {tooltip}
                        </div>
                        {children}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
});

SidebarCollapsedSection.displayName = 'SidebarCollapsedSection';
SidebarSection.displayName = 'SidebarSection';
