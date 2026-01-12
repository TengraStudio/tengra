import React from 'react'
import { motion } from '@/lib/framer-motion-compat'
import { cn } from '@/lib/utils'

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
    }

    const statusConfig = {
        online: {
            color: 'bg-emerald-500',
            glow: 'shadow-emerald-500/50',
            pulse: true,
            defaultLabel: 'Online'
        },
        warning: {
            color: 'bg-amber-500',
            glow: 'shadow-amber-500/50',
            pulse: true,
            defaultLabel: 'Warning'
        },
        error: {
            color: 'bg-red-500',
            glow: 'shadow-red-500/50',
            pulse: true,
            defaultLabel: 'Error'
        },
        offline: {
            color: 'bg-gray-400',
            glow: '',
            pulse: false,
            defaultLabel: 'Offline'
        },
        loading: {
            color: 'bg-blue-500',
            glow: 'shadow-blue-500/50',
            pulse: false,
            defaultLabel: 'Loading'
        },
        idle: {
            color: 'bg-gray-500',
            glow: '',
            pulse: false,
            defaultLabel: 'Idle'
        }
    }

    const config = statusConfig[status]

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
                <span className="text-[10px] text-muted-foreground">
                    {label}
                </span>
            )}
        </div>
    )
}

SidebarStatusIndicator.displayName = 'SidebarStatusIndicator'
