/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import type { Icon } from '@tabler/icons-react';
import { cva, type VariantProps } from 'class-variance-authority';
import React from 'react';

import { Tooltip } from '@/components/ui/tooltip';
import { UI_PRIMITIVES } from '@/constants/ui-primitives';
import { motion } from '@/lib/framer-motion-compat';
import { cn } from '@/lib/utils';

const sidebarItemVariants = cva(
    'w-full cursor-pointer items-center gap-3 rounded-lg border border-transparent px-3 py-2 transition-all duration-200 flex',
    {
        variants: {
            variant: {
                default: '',
                ghost: 'hover:bg-muted/40',
                glass: 'hover:bg-background/40 hover:backdrop-blur-sm',
            },
            active: {
                true: 'bg-primary/10 font-medium text-primary',
                false: 'text-muted-foreground hover:bg-muted/30 hover:text-foreground',
            },
            isCollapsed: {
                true: 'justify-center px-0',
                false: '',
            },
        },
        defaultVariants: {
            variant: "default",
            active: false,
            isCollapsed: false,
        },
    }
);

export interface SidebarItemProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof sidebarItemVariants> {
    icon: Icon;
    label: string;
    badge?: number | string;
    actions?: React.ReactNode;
    iconClassName?: string;
    labelClassName?: string;
}

/**
 * Individual item component for the sidebar navigation.
 */
export const SidebarItem = React.forwardRef<HTMLButtonElement, SidebarItemProps>(
    (
        {
            icon: Icon,
            label,
            active = false,
            onClick,
            badge,
            isCollapsed,
            className,
            labelClassName,
            actions,
            children,
            variant = 'default',
            iconClassName,
            ...props
        },
        ref
    ) => (
        <div className="group/item relative px-2 py-0.5">
            {active && (
                <motion.div
                    className="absolute left-0 top-1/2 z-10 h-5 w-1 -translate-y-1/2 rounded-r bg-primary"
                    layout
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -4 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
            )}
            <Tooltip content={label} side="right" disabled={!isCollapsed}>
                <button
                    {...props}
                    ref={ref}
                    onClick={onClick}
                    aria-label={props['aria-label'] ?? label}
                    className={cn(sidebarItemVariants({ active, variant, isCollapsed, className }))}
                >
                    <div className="relative flex items-center justify-center shrink-0">
                        {Icon && (
                            <Icon
                                className={cn(
                                    'w-4 h-4 transition-all duration-200',
                                    active
                                        ? 'opacity-100 scale-110'
                                        : 'opacity-70 group-hover/item:opacity-100',
                                    iconClassName
                                )}
                            />
                        )}
                    </div>

                    {!isCollapsed && (
                        <>
                            <span className={cn('flex-1 truncate text-left text-sm', labelClassName)}>
                                {label}
                            </span>
                            {badge !== undefined && (
                                <span
                                    className={cn(
                                        'text-sm px-1.5 py-0.5 rounded-full font-bold',
                                        active
                                            ? 'bg-primary/20 text-primary'
                                            : 'bg-muted/50 text-muted-foreground'
                                    )}
                                >
                                    {badge}
                                </span>
                            )}
                        </>
                    )}
                </button>
            </Tooltip>

            {/* Hover Actions */}
            {!isCollapsed && actions && (
                <div className={UI_PRIMITIVES.ACTION_BUTTON_GHOST}>{actions}</div>
            )}

            {/* Inline children (like edit input) */}
            {children}
        </div>
    )
);

SidebarItem.displayName = 'SidebarItem';

