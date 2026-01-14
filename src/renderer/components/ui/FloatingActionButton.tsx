import { Plus, X } from 'lucide-react'
import React, { useEffect,useRef, useState } from 'react'

import { cn } from '@/lib/utils'

interface FabAction {
    icon: React.ReactNode
    label: string
    onClick: () => void
    color?: string
}

interface FloatingActionButtonProps {
    actions: FabAction[]
    className?: string
    position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
    mainIcon?: React.ReactNode
    closeIcon?: React.ReactNode
}

/**
 * FloatingActionButton Component
 * 
 * A floating action button with a radial menu of actions.
 * 
 * @example
 * ```tsx
 * <FloatingActionButton
 *   actions={[
 *     { icon: <Plus />, label: 'New Chat', onClick: () => {} },
 *     { icon: <Settings />, label: 'Settings', onClick: () => {} }
 *   ]}
 * />
 * ```
 */
export const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({
    actions,
    className,
    position = 'bottom-right',
    mainIcon = <Plus className="w-6 h-6" />,
    closeIcon = <X className="w-6 h-6" />
}) => {
    const [isOpen, setIsOpen] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false)
            }
        }

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside)
        }

        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [isOpen])

    // Close on escape
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {setIsOpen(false)}
        }

        if (isOpen) {
            document.addEventListener('keydown', handleEscape)
        }

        return () => document.removeEventListener('keydown', handleEscape)
    }, [isOpen])

    const positionClasses = {
        'bottom-right': 'bottom-6 right-6',
        'bottom-left': 'bottom-6 left-6',
        'top-right': 'top-6 right-6',
        'top-left': 'top-6 left-6'
    }

    // Calculate radial positions for actions
    const getActionPosition = (index: number, total: number) => {
        const angleStep = Math.PI / (total + 1)
        const angle = angleStep * (index + 1) + (position.includes('right') ? Math.PI / 2 : 0)
        const radius = 80
        
        const x = Math.cos(angle) * radius
        const y = -Math.sin(angle) * radius

        return { x, y }
    }

    return (
        <div
            ref={containerRef}
            className={cn(
                'fixed z-50',
                positionClasses[position],
                className
            )}
        >
            {/* Action buttons */}
            {actions.map((action, index) => {
                const { x, y } = getActionPosition(index, actions.length)
                return (
                    <button
                        key={action.label}
                        onClick={() => {
                            action.onClick()
                            setIsOpen(false)
                        }}
                        className={cn(
                            'absolute w-12 h-12 rounded-full shadow-lg flex items-center justify-center',
                            'transition-all duration-300 ease-out',
                            'hover:scale-110 ripple',
                            action.color || 'bg-primary text-primary-foreground',
                            isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
                        )}
                        style={{
                            transform: isOpen
                                ? `translate(${x}px, ${y}px) scale(1)`
                                : 'translate(0, 0) scale(0)',
                            transitionDelay: isOpen ? `${index * 50}ms` : '0ms'
                        }}
                        title={action.label}
                        aria-label={action.label}
                    >
                        {action.icon}
                    </button>
                )
            })}

            {/* Labels */}
            {isOpen && actions.map((action, index) => {
                const { x, y } = getActionPosition(index, actions.length)
                return (
                    <span
                        key={`label-${action.label}`}
                        className={cn(
                            'absolute px-2 py-1 text-xs font-medium rounded bg-black/80 text-white',
                            'whitespace-nowrap pointer-events-none',
                            'transition-all duration-300'
                        )}
                        style={{
                            transform: `translate(${x - 40}px, ${y + 50}px)`,
                            opacity: isOpen ? 1 : 0
                        }}
                    >
                        {action.label}
                    </span>
                )
            })}

            {/* Main FAB button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    'w-14 h-14 rounded-full shadow-lg flex items-center justify-center',
                    'bg-primary text-primary-foreground',
                    'transition-all duration-300 ease-out',
                    'hover:scale-105 hover:shadow-xl ripple',
                    isOpen && 'rotate-45 bg-red-500'
                )}
                aria-label={isOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={isOpen}
            >
                {isOpen ? closeIcon : mainIcon}
            </button>
        </div>
    )
}

FloatingActionButton.displayName = 'FloatingActionButton'
