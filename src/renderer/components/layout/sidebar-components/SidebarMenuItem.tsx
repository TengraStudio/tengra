import React, { useState } from 'react'
import { motion } from '@/lib/framer-motion-compat'
import { cn } from '@/lib/utils'
import { SidebarStatusIndicator, StatusType } from './SidebarStatusIndicator'

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
}

export const SidebarMenuItem: React.FC<SidebarMenuItemProps> = ({
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
    className
}) => {
    const [isHovered, setIsHovered] = useState(false)

    const indentClasses = {
        0: 'pl-3',
        1: 'pl-7',
        2: 'pl-11',
        3: 'pl-14'
    }

    return (
        <motion.button
            onClick={onClick}
            disabled={isDisabled}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={cn(
                'sidebar-menu-item',
                'w-full flex items-center gap-3 py-2 pr-3 mx-1 rounded-lg',
                'text-sm font-medium transition-all duration-150',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
                'group relative',
                indentClasses[indent],
                isActive ? [
                    'bg-primary/10 text-primary',
                    'before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2',
                    'before:w-[3px] before:h-4 before:bg-primary before:rounded-full'
                ] : [
                    'text-muted-foreground hover:text-foreground',
                    'hover:bg-muted/10'
                ],
                isDisabled && 'opacity-50 cursor-not-allowed',
                className
            )}
            whileHover={{ x: isDisabled ? 0 : 2 }}
            whileTap={{ scale: isDisabled ? 1 : 0.98 }}
        >
            {/* Icon */}
            <span className={cn(
                'shrink-0 transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
            )}>
                {icon}
            </span>

            {/* Label and Description */}
            <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center gap-2">
                    <span className="truncate">{label}</span>
                    {shortcut && (
                        <kbd className="hidden group-hover:inline-flex px-1.5 py-0.5 text-[10px] font-mono bg-muted rounded text-muted-foreground">
                            {shortcut}
                        </kbd>
                    )}
                </div>
                {description && (
                    <p className="text-[11px] text-muted-foreground/60 truncate">
                        {description}
                    </p>
                )}
            </div>

            {/* Status Indicator */}
            {status && (
                <SidebarStatusIndicator 
                    status={status} 
                    label={statusLabel}
                    size="sm"
                />
            )}

            {/* Badge */}
            {badge !== undefined && !status && (
                <span className={cn(
                    'px-1.5 py-0.5 rounded-full text-[10px] font-semibold',
                    'bg-muted text-muted-foreground'
                )}>
                    {typeof badge === 'number' && badge > 99 ? '99+' : badge}
                </span>
            )}

            {/* Hover Actions */}
            {actions && isHovered && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-1"
                    onClick={(e: React.MouseEvent) => e.stopPropagation()}
                >
                    {actions}
                </motion.div>
            )}
        </motion.button>
    )
}

SidebarMenuItem.displayName = 'SidebarMenuItem'
