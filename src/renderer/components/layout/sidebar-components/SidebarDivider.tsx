/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import React from 'react';

import { cn } from '@/lib/utils';

export interface SidebarDividerProps {
    /** Optional label in center of divider */
    label?: string
    /** Spacing size */
    spacing?: 'sm' | 'md' | 'lg'
    /** Custom class name */
    className?: string
}

export const SidebarDivider: React.FC<SidebarDividerProps> = ({
    label,
    spacing = 'md',
    className
}) => {
    const spacingClasses = {
        sm: 'my-1',
        md: 'my-2',
        lg: 'my-4'
    };

    if (label) {
        return (
            <div className={cn(
                'flex items-center gap-2 px-3',
                spacingClasses[spacing],
                className
            )}>
                <div className="flex-1 h-px bg-gradient-to-r from-border/50 to-transparent" />
                <span className="text-xxxs font-semibold text-muted-foreground/40">
                    {label}
                </span>
                <div className="flex-1 h-px bg-gradient-to-l from-border/50 to-transparent" />
            </div>
        );
    }

    return (
        <div className={cn(
            'h-px mx-3',
            'bg-gradient-to-r from-transparent via-border/50 to-transparent',
            spacingClasses[spacing],
            className
        )} />
    );
};

SidebarDivider.displayName = 'SidebarDivider';
