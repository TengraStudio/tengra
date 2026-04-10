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
            className={cn("tengra-breadcrumb", className)}
            aria-label={t('aria.breadcrumb')}
        >
            <ol className="tengra-breadcrumb__list">
                {showHome && (
                    <>
                        <li>
                            <button
                                onClick={() => items[0]?.onClick?.()}
                                className="tengra-breadcrumb__home"
                                aria-label={t('aria.home')}
                            >
                                <Home className="w-4 h-4" />
                            </button>
                        </li>
                        {items.length > 0 && (
                            <li className="tengra-breadcrumb__item" aria-hidden="true">
                                {separator}
                            </li>
                        )}
                    </>
                )}
                {items.map((item, index) => {
                    const isLast = index === items.length - 1;
                    return (
                        <li key={index} className="tengra-breadcrumb__item">
                            {item.onClick && !isLast ? (
                                <button
                                    onClick={item.onClick}
                                    className="tengra-breadcrumb__link"
                                >
                                    {item.icon && <span className="tengra-breadcrumb__icon">{item.icon}</span>}
                                    <span className="truncate max-w-48">{item.label}</span>
                                </button>
                            ) : (
                                <span 
                                    className={cn(
                                        "tengra-breadcrumb__text",
                                        isLast && "tengra-breadcrumb__text--active"
                                    )}
                                    aria-current={isLast ? 'page' : undefined}
                                >
                                    {item.icon && <span className="tengra-breadcrumb__icon">{item.icon}</span>}
                                    {item.label}
                                </span>
                            )}
                            {!isLast && (
                                <span className="tengra-breadcrumb__separator" aria-hidden="true">
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
