import { LucideIcon } from 'lucide-react';
import React from 'react';

import { Tooltip } from '@/components/ui/tooltip';
import { motion } from '@/lib/framer-motion-compat';
import { cn } from '@/lib/utils';

export interface SidebarItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    icon: LucideIcon;
    label: string;
    active?: boolean;
    // onClick, className, children are inherited
    badge?: number | string;
    isCollapsed?: boolean;
    actions?: React.ReactNode;
    variant?: 'default' | 'ghost' | 'glass';
    iconClassName?: string;
}

function getButtonClassName(
    active: boolean,
    variant: string,
    isCollapsed?: boolean,
    className?: string
): string {
    const baseClasses = cn(
        'w-full flex items-center px-3 py-2 rounded-lg text-sm transition-all duration-200 border border-transparent',
        isCollapsed ? 'justify-center px-0' : 'gap-3'
    );
    const activeClasses = 'bg-primary/10 text-primary font-medium border-primary/5 shadow-sm';
    const inactiveClasses = 'text-muted-foreground hover:text-foreground hover:bg-muted/30';
    const glassClasses =
        variant === 'glass' && !active ? 'hover:bg-background/40 hover:backdrop-blur-sm' : '';

    return cn(baseClasses, active ? activeClasses : inactiveClasses, glassClasses, className);
}

export const SidebarItem: React.FC<SidebarItemProps> = ({
    icon: Icon,
    label,
    active = false,
    onClick,
    badge,
    isCollapsed,
    className,
    actions,
    children,
    variant = 'default',
    iconClassName,
    ...props
}) => (
    <div className="group/item relative">
        {active && (
            <motion.div
                className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-4 bg-primary rounded-r-full z-10"
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -4 }}
            />
        )}
        <Tooltip content={label} side="right" delay={0} disabled={!isCollapsed}>
            <button
                {...props}
                onClick={onClick}
                aria-label={props['aria-label'] ?? label}
                className={getButtonClassName(active, variant, isCollapsed, className)}
            >
                <div className="relative flex items-center justify-center">
                    <Icon
                        className={cn(
                            'w-4 h-4 shrink-0 transition-transform duration-200 group-hover/item:scale-110',
                            active ? 'opacity-100' : 'opacity-70 group-hover/item:opacity-100',
                            iconClassName
                        )}
                    />
                </div>

                {!isCollapsed && (
                    <>
                        <span className="flex-1 text-left truncate">{label}</span>
                        {badge !== undefined && (
                            <span
                                className={cn(
                                    'text-xxs px-1.5 py-0.5 rounded-full',
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
            <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover/item:opacity-100 flex items-center gap-1 transition-opacity bg-card border border-border/50 shadow-sm rounded-md px-1 py-0.5">
                {actions}
            </div>
        )}

        {/* Inline children (like edit input) */}
        {children}
    </div>
);

SidebarItem.displayName = 'SidebarItem';
