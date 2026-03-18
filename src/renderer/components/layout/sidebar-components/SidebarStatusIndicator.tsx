import React from 'react';

import { motion } from '@/lib/framer-motion-compat';
import { cn } from '@/lib/utils';

export type StatusType = 'online' | 'warning' | 'error' | 'offline' | 'loading' | 'idle'

export interface SidebarStatusIndicatorProps {
    status: StatusType
    size?: 'sm' | 'md' | 'lg'
    showPulse?: boolean
    label?: string
    className?: string
}

export const SidebarStatusIndicator: React.FC<SidebarStatusIndicatorProps> = ({
    status,
    size = 'sm',
    showPulse = true,
    label,
    className
}) => {
    const sizeClasses = {
        sm: 'w-1.5 h-1.5',
        md: 'w-2 h-2',
        lg: 'w-2.5 h-2.5'
    };

    const statusConfig = {
        online: {
            color: 'bg-success',
            glow: 'shadow-success/50',
            pulse: true
        },
        warning: {
            color: 'bg-warning',
            glow: 'shadow-warning/50',
            pulse: true
        },
        error: {
            color: 'bg-destructive',
            glow: 'shadow-destructive/50',
            pulse: true
        },
        offline: {
            color: 'bg-muted',
            glow: '',
            pulse: false
        },
        loading: {
            color: 'bg-primary',
            glow: 'shadow-primary/50',
            pulse: false
        },
        idle: {
            color: 'bg-muted',
            glow: '',
            pulse: false
        }
    };

    const config = statusConfig[status];

    return (
        <div className={cn('flex items-center gap-1.5', className)}>
            <div className="relative">
                {/* Pulse ring */}
                {showPulse && config.pulse && (
                    <motion.span
                        className={cn(
                            'absolute inset-0 rounded-full',
                            config.color,
                            'opacity-40'
                        )}
                        animate={{
                            scale: [1, 1.8, 1],
                            opacity: [0.4, 0, 0.4]
                        }}
                        transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: 'easeInOut'
                        }}
                    />
                )}
                
                {/* Main dot */}
                <span
                    className={cn(
                        'relative block rounded-full',
                        sizeClasses[size],
                        config.color,
                        config.glow && 'shadow-sm',
                        config.glow,
                        status === 'loading' && 'animate-pulse'
                    )}
                />
            </div>
            
            {label && (
                <span className="text-xxs text-muted-foreground">
                    {label}
                </span>
            )}
        </div>
    );
};

SidebarStatusIndicator.displayName = 'SidebarStatusIndicator';
