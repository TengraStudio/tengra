/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import React, { useState } from 'react';

import { SidebarStatusIndicator, StatusType } from '@/components/layout/sidebar-components/SidebarStatusIndicator';
import { motion } from '@/lib/framer-motion-compat';
import { cn } from '@/lib/utils';

export interface SidebarMenuItemProps {
    /** Unique identifier */
    id: string
    /** Icon component */
    icon: React.ReactNode
    /** Display label */
    label: string
    /** Optional description shown below label */
    description?: string
    /** Click handler */
    onClick: () => void
    /** Current status */
    status?: StatusType
    /** Status label shown next to indicator */
    statusLabel?: string
    /** Badge content */
    badge?: number | string
    /** Whether item is currently active */
    isActive?: boolean
    /** Whether item is disabled */
    isDisabled?: boolean
    /** Indentation level (0-3) */
    indent?: 0 | 1 | 2 | 3
    /** Right-side actions */
    actions?: React.ReactNode
    /** Keyboard shortcut hint */
    shortcut?: string
    /** Custom class name */
    className?: string
    /** HTML title attribute for accessibility */
    title?: string
}

type IndentLevel = 0 | 1 | 2 | 3;

const INDENT_CLASSES: Record<IndentLevel, string> = {
    0: 'pl-3',
    1: 'pl-7',
    2: 'pl-11',
    3: 'pl-14'
};

const ACTIVE_CLASSES = [
    'bg-primary/10 text-primary',
    'before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2',
    'before:w-1 before:h-4 before:bg-primary before:rounded-full'
];

const INACTIVE_CLASSES = [
    'text-muted-foreground hover:text-foreground',
    'hover:bg-muted/10'
];

function formatBadge(badge: number | string): string | number {
    return typeof badge === 'number' && badge > 99 ? '99+' : badge;
}

function getMenuItemClassName(
    indent: IndentLevel,
    isActive: boolean,
    isDisabled: boolean,
    customClassName?: string
): string {
    return cn(
        'sidebar-menu-item',
        'w-full flex items-center gap-3 py-2 pr-3 mx-1 rounded-lg',
        'text-sm font-medium transition-all duration-150',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
        'group relative',
        INDENT_CLASSES[indent],
        isActive ? ACTIVE_CLASSES : INACTIVE_CLASSES,
        isDisabled && 'opacity-50 cursor-not-allowed pointer-events-none',
        customClassName
    );
}

interface MenuItemIconProps {
    icon: React.ReactNode
    isActive: boolean
}

const MenuItemIcon: React.FC<MenuItemIconProps> = ({ icon, isActive }) => (
    <span className={cn(
        'shrink-0 transition-colors',
        isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
    )}>
        {icon}
    </span>
);

interface MenuItemLabelProps {
    label: string
    description?: string
    shortcut?: string
}

const MenuItemLabel: React.FC<MenuItemLabelProps> = ({ label, description, shortcut }) => (
    <div className="flex-1 min-w-0 text-left">
        <div className="flex items-center gap-2">
            <span className="truncate">{label}</span>
            {shortcut && (
                <kbd className="hidden group-hover:inline-flex px-1.5 py-0.5 text-sm font-mono bg-muted rounded text-muted-foreground">
                    {shortcut}
                </kbd>
            )}
        </div>
        {description && <p className="text-sm text-muted-foreground/60 truncate">{description}</p>}
    </div>
);

interface MenuItemBadgeProps {
    badge: number | string
}

const MenuItemBadge: React.FC<MenuItemBadgeProps> = ({ badge }) => (
    <span className="px-1.5 py-0.5 rounded-full text-sm font-semibold bg-muted text-muted-foreground">
        {formatBadge(badge)}
    </span>
);

interface MenuItemActionsProps {
    show: boolean;
    actions: React.ReactNode;
}

const MenuItemActions: React.FC<MenuItemActionsProps> = ({ show, actions }) => {
    if (!show) { return null; }
    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-1" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            {actions}
        </motion.div>
    );
};

interface StatusSectionProps {
    status?: StatusType;
    statusLabel?: string;
    badge?: number | string;
}

const StatusSection: React.FC<StatusSectionProps> = ({ status, statusLabel, badge }) => {
    if (status) {
        return <SidebarStatusIndicator status={status} label={statusLabel} size="sm" />;
    }
    if (badge !== undefined) {
        return <MenuItemBadge badge={badge} />;
    }
    return null;
};

const getHoverProps = (isDisabled: boolean) => ({
    whileHover: { x: isDisabled ? 0 : 2 },
    whileTap: { scale: isDisabled ? 1 : 0.98 }
});

export const SidebarMenuItem: React.FC<SidebarMenuItemProps> = React.memo(({
    id: _id,
    icon,
    label,
    description,
    onClick,
    status,
    statusLabel,
    badge,
    isActive = false,
    isDisabled = false,
    indent = 0,
    actions,
    shortcut,
    className,
    title
}) => {
    const [isHovered, setIsHovered] = useState(false);
    const hoverProps = getHoverProps(isDisabled);

    return (
        <motion.button
            onClick={onClick}
            aria-disabled={isDisabled}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={getMenuItemClassName(indent, isActive, isDisabled, className)}
            title={title || label}
            {...hoverProps}
        >
            <MenuItemIcon icon={icon} isActive={isActive} />
            <MenuItemLabel label={label} description={description} shortcut={shortcut} />
            <StatusSection status={status} statusLabel={statusLabel} badge={badge} />
            <MenuItemActions show={Boolean(actions && isHovered)} actions={actions} />
        </motion.button>
    );
});

SidebarMenuItem.displayName = 'SidebarMenuItem';

