/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { ChevronRight, Home } from 'lucide-react';
import React from 'react';

import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';


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
    separator = <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 rtl-flip" />
}: BreadcrumbProps) {
    const { t } = useTranslation();

    if (items.length === 0) {return null;}

    return (
        <nav 
            className={cn("flex items-center gap-2 text-sm", className)}
            aria-label={t('aria.breadcrumb')}
        >
            <ol className="flex items-center gap-2 m-0 p-0 list-none">
                {showHome && (
                    <>
                        <li>
                            <button
                                onClick={() => items[0]?.onClick?.()}
                                className="flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground bg-transparent border-none cursor-pointer p-0"
                                aria-label={t('aria.home')}
                            >
                                <Home className="w-4 h-4" />
                            </button>
                        </li>
                        {items.length > 0 && (
                            <li className="flex items-center gap-2" aria-hidden="true">
                                <span className="flex items-center text-muted-foreground/50 rtl:rotate-180">
                                    {separator}
                                </span>
                            </li>
                        )}
                    </>
                )}
                {items.map((item, index) => {
                    const isLast = index === items.length - 1;
                    return (
                        <li key={index} className="flex items-center gap-2">
                            {item.onClick && !isLast ? (
                                <button
                                    onClick={item.onClick}
                                    className="flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground bg-transparent border-none cursor-pointer p-0 font-inherit"
                                >
                                    {item.icon && <span className="shrink-0">{item.icon}</span>}
                                    <span className="truncate max-w-48">{item.label}</span>
                                </button>
                            ) : (
                                <span 
                                    className={cn(
                                        "flex items-center gap-1.5 text-muted-foreground max-w-48 overflow-hidden text-ellipsis whitespace-nowrap",
                                        isLast && "text-foreground font-medium"
                                    )}
                                    aria-current={isLast ? 'page' : undefined}
                                >
                                    {item.icon && <span className="shrink-0">{item.icon}</span>}
                                    {item.label}
                                </span>
                            )}
                            {!isLast && (
                                <span className="flex items-center text-muted-foreground/50 rtl:rotate-180" aria-hidden="true">
                                    {separator}
                                </span>
                            )}
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
}
