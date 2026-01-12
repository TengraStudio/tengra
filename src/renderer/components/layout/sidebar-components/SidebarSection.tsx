import React, { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from '@/lib/framer-motion-compat'
import { ChevronDown, ChevronRight } from 'lucide-react'
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

export const SidebarSection: React.FC<SidebarSectionProps> = ({
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
        const newState = !isExpanded
        setIsExpanded(newState)
        onExpandedChange?.(newState)
    }, [isExpanded, onExpandedChange])

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
                onClick={toggleExpanded}
                className={cn(
                    'sidebar-section-header',
                    'w-full flex items-center justify-between',
                    'px-3 py-2 mx-1 rounded-md',
                    'text-[11px] font-semibold uppercase tracking-wider',
                    'text-muted-foreground/70 hover:text-muted-foreground',
                    'hover:bg-muted/5 transition-all duration-200',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
                    'group'
                )}
                aria-expanded={isExpanded}
                aria-controls={`section-content-${id}`}
            >
                <div className="flex items-center gap-2">
                    {/* Chevron */}
                    <motion.div
                        animate={{ rotate: isExpanded ? 0 : -90 }}
                        transition={{ duration: 0.2 }}
                    >
                        <ChevronDown className="w-3 h-3 opacity-50 group-hover:opacity-100" />
                    </motion.div>
                    
                    {/* Icon */}
                    {icon && (
                        <span className="opacity-60 group-hover:opacity-100 transition-opacity">
                            {icon}
                        </span>
                    )}
                    
                    {/* Title */}
                    <span>{title}</span>
                </div>

                {/* Badge */}
                {badge !== undefined && (
                    <span className={cn(
                        'px-1.5 py-0.5 rounded text-[10px] font-medium',
                        badgeClasses[badgeVariant]
                    )}>
                        {badge}
                    </span>
                )}
            </button>

            {/* Section Content with Animation */}
            <AnimatePresence initial={false}>
                {isExpanded && (
                    <motion.div
                        id={`section-content-${id}`}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ 
                            height: 'auto', 
                            opacity: 1,
                            transition: {
                                height: { duration: 0.25, ease: [0.4, 0, 0.2, 1] },
                                opacity: { duration: 0.2, delay: 0.05 }
                            }
                        }}
                        exit={{ 
                            height: 0, 
                            opacity: 0,
                            transition: {
                                height: { duration: 0.2, ease: [0.4, 0, 0.2, 1] },
                                opacity: { duration: 0.1 }
                            }
                        }}
                        className="overflow-hidden"
                    >
                        <div ref={contentRef} className="py-1 space-y-0.5">
                            {children}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

// Collapsed mode component with flyout
const SidebarCollapsedSection: React.FC<{
    icon: React.ReactNode
    tooltip: string
    badge?: number | string
    children: React.ReactNode
}> = ({ icon, tooltip, badge, children }) => {
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
}

SidebarSection.displayName = 'SidebarSection'
