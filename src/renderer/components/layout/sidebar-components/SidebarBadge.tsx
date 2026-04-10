import React from 'react';

import { AnimatePresence,motion } from '@/lib/framer-motion-compat';
import { cn } from '@/lib/utils';

export interface SidebarBadgeProps {
    /** Badge content - number or string */
    value: number | string
    /** Maximum number before showing "+" */
    max?: number
    /** Badge style variant */
    variant?: 'default' | 'primary' | 'warning' | 'error' | 'success'
    /** Size */
    size?: 'sm' | 'md'
    /** Whether badge should be a dot only */
    dot?: boolean
    /** Animate on value change */
    animate?: boolean
    /** Custom class name */
    className?: string
}

type BadgeVariant = 'default' | 'primary' | 'warning' | 'error' | 'success';
type BadgeSize = 'sm' | 'md';

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
    default: 'bg-muted text-muted-foreground',
    primary: 'bg-primary text-primary-foreground',
    warning: 'bg-warning text-foreground',
    error: 'bg-destructive text-foreground',
    success: 'bg-success text-foreground'
};

const SIZE_CLASSES: Record<BadgeSize, { dot: string; badge: string }> = {
    sm: { dot: 'w-2 h-2', badge: 'min-w-4 h-4 px-1.5 text-xxs' },
    md: { dot: 'w-2.5 h-2.5', badge: 'min-w-6 h-6 px-2 typo-caption' }
};

function formatBadgeValue(value: number | string, max: number): string | number {
    return typeof value === 'number' && value > max ? `${max}+` : value;
}

interface DotBadgeProps {
    size: BadgeSize
    variant: BadgeVariant
    className?: string
}

const DotBadge: React.FC<DotBadgeProps> = ({ size, variant, className }) => (
    <span className={cn('rounded-full', SIZE_CLASSES[size].dot, VARIANT_CLASSES[variant], className)} />
);

export const SidebarBadge: React.FC<SidebarBadgeProps> = React.memo(({
    value,
    max = 99,
    variant = 'default',
    size = 'sm',
    dot = false,
    animate = true,
    className
}) => {
    if (dot) {
        return <DotBadge size={size} variant={variant} className={className} />;
    }

    const displayValue = formatBadgeValue(value, max);

    return (
        <AnimatePresence mode="wait">
            <motion.span
                key={String(value)}
                initial={animate ? { scale: 0.5, opacity: 0 } : undefined}
                animate={{ scale: 1, opacity: 1 }}
                exit={animate ? { scale: 0.5, opacity: 0 } : undefined}
                className={cn(
                    'inline-flex items-center justify-center rounded-full font-semibold',
                    SIZE_CLASSES[size].badge,
                    VARIANT_CLASSES[variant],
                    className
                )}
            >
                {displayValue}
            </motion.span>
        </AnimatePresence>
    );
});

SidebarBadge.displayName = 'SidebarBadge';
