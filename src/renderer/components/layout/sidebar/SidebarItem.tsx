import { LucideIcon } from 'lucide-react'
import React from 'react'

import { motion } from '@/lib/framer-motion-compat'
import { cn } from '@/lib/utils'

export interface SidebarItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    icon: LucideIcon
    label: string
    active?: boolean
    // onClick, className, children are inherited
    badge?: number | string
    isCollapsed?: boolean
    actions?: React.ReactNode
    variant?: 'default' | 'ghost' | 'glass'
}

export const SidebarItem: React.FC<SidebarItemProps> = ({
    icon: Icon,
    label,
    active,
    onClick,
    badge,
    isCollapsed,
    className,
    actions,
    children,
    variant = 'default',
    ...props
}) => {
    return (
        <div className="group/item relative">
            <button
                {...props}
                onClick={onClick}
                className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200",
                    "border border-transparent",
                    active
                        ? "bg-primary/10 text-primary font-medium border-primary/5 shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/30",
                    variant === 'glass' && !active && "hover:bg-background/40 hover:backdrop-blur-sm",
                    className
                )}
            >
                <div className="relative">
                    <Icon className={cn(
                        "w-4 h-4 shrink-0 transition-transform duration-200 group-hover/item:scale-110",
                        active ? "opacity-100" : "opacity-70 group-hover/item:opacity-100"
                    )} />
                    {active && (
                        <motion.div
                            className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-3 bg-primary rounded-r-full"
                            initial={{ opacity: 0, scaleY: 0.5 }}
                            animate={{ opacity: 1, scaleY: 1 }}
                            exit={{ opacity: 0, scaleY: 0.5 }}
                        />
                    )}
                </div>

                {!isCollapsed && (
                    <>
                        <span className="flex-1 text-left truncate">{label}</span>
                        {badge !== undefined && (
                            <span className={cn(
                                "text-[10px] px-1.5 py-0.5 rounded-full",
                                active ? "bg-primary/20 text-primary" : "bg-muted/50 text-muted-foreground"
                            )}>
                                {badge}
                            </span>
                        )}
                    </>
                )}
            </button>

            {/* Hover Actions */}
            {!isCollapsed && actions && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover/item:opacity-100 flex items-center gap-1 transition-opacity bg-background/50 backdrop-blur-sm rounded-md px-1">
                    {actions}
                </div>
            )}

            {/* Inline children (like edit input) */}
            {children}
        </div>
    )
}
