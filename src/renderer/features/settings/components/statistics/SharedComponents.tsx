/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { cn } from '@/lib/utils';

function resolveProgressColor(color: string): string {
    if (color.startsWith('var(')) {
        return `hsl(${color})`;
    }
    return color;
}

export const HorizontalProgressBar = ({ percentage, color = "var(--primary)" }: { percentage: number, color?: string }) => {
    const resolvedColor = resolveProgressColor(color);

    return (
        <div className="h-1 w-full bg-muted/10 rounded-full overflow-hidden">
            <div
                className="h-full rounded-full transition-all duration-1000 ease-out"
                style={{
                    width: `${Math.max(0, Math.min(100, percentage))}%`,
                    backgroundColor: resolvedColor
                }}
            />
        </div>
    );
};

export const StatusBadge = ({ status, text }: { status: 'active' | 'error' | 'expired', text: string }) => {
    const colors = {
        active: "bg-success/10 text-success border-success/20",
        error: "bg-destructive/10 text-destructive border-destructive/20",
        expired: "bg-warning/10 text-warning border-warning/20",
    };

    const dots = {
        active: "bg-success",
        error: "bg-destructive",
        expired: "bg-warning",
    };

    return (
        <div className={cn("typo-overline font-bold py-0.5 px-2.5 rounded-full border flex items-center gap-2", colors[status])}>
            <div className={cn("w-1.5 h-1.5 rounded-full", dots[status])} />
            {text}
        </div>
    );
};

export const getQuotaColor = (percentage: number): string => {
    if (percentage <= 10) {
        return 'var(--destructive)';
    }
    if (percentage <= 60) {
        return 'var(--warning)';
    }
    return 'var(--success)';
};

