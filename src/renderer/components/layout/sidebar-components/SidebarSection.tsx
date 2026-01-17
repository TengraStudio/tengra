import { ChevronDown, ChevronRight } from 'lucide-react'
import React, { useCallback, useEffect, useRef, useState } from 'react'

import { AnimatePresence, motion } from '@/lib/framer-motion-compat'
import { cn } from '@/lib/utils'

export interface SidebarSectionProps {
    /** Unique identifier for persistence */
    id: string
    /** Section title displayed in header */
    title: string
    /** Icon component to display before title */
    icon?: React.ReactNode
    /** Whether section starts expanded */
    defaultExpanded?: boolean
    /** Badge content (number or string) */
    badge?: number | string
    /** Badge variant for styling */
    badgeVariant?: 'default' | 'warning' | 'error' | 'success'
    /** Called when expansion state changes */
    onExpandedChange?: (expanded: boolean) => void
    /** Whether to persist state to localStorage */
    persistState?: boolean
    /** Custom class name */
    className?: string
    /** Section content */
    children: React.ReactNode
    /** Collapsed sidebar mode - shows flyout instead */
    isCollapsed?: boolean
    /** Tooltip for collapsed mode */
    tooltip?: string
}

export const SidebarSection: React.FC<SidebarSectionProps> = React.memo(({
    id,
    title,
    icon,
    defaultExpanded = true,
    badge,
    badgeVariant = 'default',
    onExpandedChange,
    persistState = true,
    className,
    children,
    isCollapsed = false,
    tooltip
}) => {
    // State management with localStorage persistence
    const storageKey = `sidebar-section-${id}`
    const [isExpanded, setIsExpanded] = useState(() => {
        if (persistState && typeof window !== 'undefined') {
            const stored = localStorage.getItem(storageKey)
            return stored !== null ? JSON.parse(stored) : defaultExpanded
        }
        return defaultExpanded
    })

    const contentRef = useRef<HTMLDivElement>(null)

    // Persist state
    useEffect(() => {
        if (persistState && typeof window !== 'undefined') {
            localStorage.setItem(storageKey, JSON.stringify(isExpanded))
        }
    }, [isExpanded, persistState, storageKey])

    const toggleExpanded = useCallback(() => {
        setIsExpanded((prev: boolean) => {
            const newState = !prev
            onExpandedChange?.(newState)
            return newState
        })
    }, [onExpandedChange])

    // Badge styling
    const badgeClasses = {
        default: 'bg-muted text-muted-foreground',
        warning: 'bg-amber-500/20 text-amber-500',
        error: 'bg-red-500/20 text-red-500',
        success: 'bg-emerald-500/20 text-emerald-500'
    }

    // Collapsed mode - render as icon button with flyout
    if (isCollapsed) {
        return (
            <SidebarCollapsedSection
                icon={icon}
                tooltip={tooltip || title}
                badge={badge}
            >
                {children}
            </SidebarCollapsedSection>
        )
    }

    return (
        <div className={cn('sidebar-section', className)}>
            {/* Section Header */}
            <button
                id={`section-header-${id}`}
                onClick={toggleExpanded}
                className={cn(
                    'sidebar-section-header',
                    'w-full flex items-center justify-between',
                    'px-3 py-2 mx-0.5 rounded-lg', // increased padding/rounding
                    'text-[11px] font-semibold uppercase tracking-wider',
                    'text-muted-foreground/70 hover:text-foreground', // higher contrast on hover
                    'hover:bg-background/40 hover:backdrop-blur-sm transition-all duration-200', // glass effect
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
                    'group',
                    isExpanded && 'text-foreground bg-background/20' // active state style
                )}
                aria-expanded={isExpanded}
            >
                <div className="flex items-center gap-2">
                    {/* Chevron */}
                    <motion.div
                        animate={{ rotate: isExpanded ? 0 : -90 }}
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                        className={cn("bg-muted/50 rounded-sm p-0.5", isExpanded && "bg-transparent")} // boxed chevron for clarity
                    >
                        <ChevronDown className="w-2.5 h-2.5 opacity-70 group-hover:opacity-100" />
                    </motion.div>

                    {/* Icon */}
                    {icon && (
                        <span className="opacity-70 group-hover:opacity-100 transition-opacity">
                            {icon}
                        </span>
                    )}

                    {/* Title */}
                    <span>{title}</span>
                </div>

                {/* Badge */}
                {badge !== undefined && (
                    <span className={cn(
                        'px-1.5 py-0.5 rounded-full text-[9px] font-medium border border-transparent',
                        badgeClasses[badgeVariant],
                        "group-hover:border-border/20 group-hover:shadow-sm transition-all"
                    )}>
                        {badge}
                    </span>
                )}
            </button>

            {/* Section Content with CSS Grid Animation for stability */}
            <div
                className={cn(
                    "sidebar-section-content",
                    isExpanded && "expanded"
                )}
                aria-hidden={!isExpanded}
                aria-labelledby={`section-header-${id}`}
            >
                <div ref={contentRef} className="py-1 space-y-0.5">
                    {children}
                </div>
            </div>
        </div>
    )
}, (prev, next) => {
    // Custom comparison to prevent re-renders from unstable children references
    // if the actual functional state hasn't changed.
    return (
        prev.id === next.id &&
        prev.title === next.title &&
        prev.isCollapsed === next.isCollapsed &&
        prev.badge === next.badge &&
        prev.badgeVariant === next.badgeVariant &&
        prev.defaultExpanded === next.defaultExpanded &&
        prev.className === next.className &&
        // If children reference is the same, we're definitely good
        (prev.children === next.children)
    )
})

// Collapsed mode component with flyout
const SidebarCollapsedSection: React.FC<{
    icon: React.ReactNode
    tooltip: string
    badge?: number | string
    children: React.ReactNode
}> = React.memo(({ icon, tooltip, badge, children }) => {
    const [isOpen, setIsOpen] = useState(false)
    const buttonRef = useRef<HTMLButtonElement>(null)
    const flyoutRef = useRef<HTMLDivElement>(null)

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                flyoutRef.current &&
                buttonRef.current &&
                !flyoutRef.current.contains(event.target as Node) &&
                !buttonRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false)
            }
        }

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside)
            return () => document.removeEventListener('mousedown', handleClickOutside)
        }
        return undefined
    }, [isOpen])

    return (
        <div className="relative">
            <button
                ref={buttonRef}
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    'w-full p-3 flex items-center justify-center',
                    'rounded-lg transition-all duration-200',
                    'hover:bg-muted/10 text-muted-foreground hover:text-foreground',
                    isOpen && 'bg-muted/10 text-foreground'
                )}
                title={tooltip}
            >
                <div className="relative">
                    {icon}
                    {badge !== undefined && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-[9px] font-bold flex items-center justify-center text-primary-foreground">
                            {typeof badge === 'number' && badge > 9 ? '9+' : badge}
                        </span>
                    )}
                </div>
                <ChevronRight className="w-3 h-3 ml-1 opacity-50" />
            </button>

            {/* Flyout Menu */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        ref={flyoutRef}
                        initial={{ opacity: 0, x: -10, scale: 0.95 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: -10, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className={cn(
                            'absolute left-full top-0 ml-2 z-50',
                            'min-w-[200px] max-w-[280px]',
                            'bg-popover border border-border rounded-xl shadow-xl',
                            'py-2'
                        )}
                    >
                        <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/50 mb-1">
                            {tooltip}
                        </div>
                        {children}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
})

SidebarSection.displayName = 'SidebarSection'
