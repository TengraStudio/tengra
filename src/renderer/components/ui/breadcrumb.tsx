import React from 'react'
import { ChevronRight, Home } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface BreadcrumbItem {
    label: string
    onClick?: () => void
    icon?: React.ReactNode
}

export interface BreadcrumbProps {
    items: BreadcrumbItem[]
    className?: string
    showHome?: boolean
    separator?: React.ReactNode
}

export function Breadcrumb({ 
    items, 
    className,
    showHome = false,
    separator = <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50" />
}: BreadcrumbProps) {
    if (items.length === 0) return null

    return (
        <nav 
            className={cn("flex items-center gap-2 text-sm", className)}
            aria-label="Breadcrumb"
        >
            <ol className="flex items-center gap-2">
                {showHome && (
                    <>
                        <li>
                            <button
                                onClick={() => items[0]?.onClick?.()}
                                className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
                                aria-label="Home"
                            >
                                <Home className="w-4 h-4" />
                            </button>
                        </li>
                        {items.length > 0 && (
                            <li className="flex items-center" aria-hidden="true">
                                {separator}
                            </li>
                        )}
                    </>
                )}
                {items.map((item, index) => {
                    const isLast = index === items.length - 1
                    return (
                        <li key={index} className="flex items-center gap-2">
                            {item.onClick && !isLast ? (
                                <button
                                    onClick={item.onClick}
                                    className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    {item.icon && <span className="flex-shrink-0">{item.icon}</span>}
                                    <span className="truncate max-w-[200px]">{item.label}</span>
                                </button>
                            ) : (
                                <span 
                                    className={cn(
                                        "flex items-center gap-1.5 truncate max-w-[200px]",
                                        isLast ? "text-foreground font-medium" : "text-muted-foreground"
                                    )}
                                    aria-current={isLast ? 'page' : undefined}
                                >
                                    {item.icon && <span className="flex-shrink-0">{item.icon}</span>}
                                    {item.label}
                                </span>
                            )}
                            {!isLast && (
                                <span className="flex items-center" aria-hidden="true">
                                    {separator}
                                </span>
                            )}
                        </li>
                    )
                })}
            </ol>
        </nav>
    )
}
