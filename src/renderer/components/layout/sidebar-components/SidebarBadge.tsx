import React from 'react'

import { AnimatePresence,motion } from '@/lib/framer-motion-compat'
import { cn } from '@/lib/utils'

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

export const SidebarBadge: React.FC<SidebarBadgeProps> = React.memo(({
    value,
    max = 99,
    variant = 'default',
    size = 'sm',
    dot = false,
    animate = true,
    className
}) => {
    const variantClasses = {
        default: 'bg-muted text-muted-foreground',
        primary: 'bg-primary text-primary-foreground',
        warning: 'bg-amber-500 text-white',
        error: 'bg-red-500 text-white',
        success: 'bg-emerald-500 text-white'
    }

    const sizeClasses = {
        sm: dot ? 'w-2 h-2' : 'min-w-[18px] h-[18px] px-1.5 text-[10px]',
        md: dot ? 'w-2.5 h-2.5' : 'min-w-[22px] h-[22px] px-2 text-xs'
    }

    const displayValue = typeof value === 'number' && value > max
        ? `${max}+`
        : value

    if (dot) {
        return (
            <span className={cn(
                'rounded-full',
                sizeClasses[size],
                variantClasses[variant],
                className
            )} />
        )
    }

    return (
        <AnimatePresence mode="wait">
            <motion.span
                key={String(value)}
                initial={animate ? { scale: 0.5, opacity: 0 } : undefined}
                animate={{ scale: 1, opacity: 1 }}
                exit={animate ? { scale: 0.5, opacity: 0 } : undefined}
                className={cn(
                    'inline-flex items-center justify-center rounded-full font-semibold',
                    sizeClasses[size],
                    variantClasses[variant],
                    className
                )}
            >
                {displayValue}
            </motion.span>
        </AnimatePresence>
    )
})

SidebarBadge.displayName = 'SidebarBadge'
