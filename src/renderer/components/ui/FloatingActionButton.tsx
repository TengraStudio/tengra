/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { Plus, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';


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
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    // Close on escape
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { setIsOpen(false); }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
        }

        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen]);

    // Calculate radial positions for actions
    const getActionPosition = (index: number, total: number) => {
        const angleStep = Math.PI / (total + 1);
        const angle = angleStep * (index + 1) + (position.includes('right') ? Math.PI / 2 : 0);
        const radius = 80;

        const x = Math.cos(angle) * radius;
        const y = -Math.sin(angle) * radius;

        return { x, y };
    };

    return (
        <div
            ref={containerRef}
            className={cn(
                'fixed z-100 flex items-center justify-center p-4',
                {
                    'bottom-6 right-6': position === 'bottom-right',
                    'bottom-6 left-6': position === 'bottom-left',
                    'top-6 right-6': position === 'top-right',
                    'top-6 left-6': position === 'top-left',
                },
                className
            )}
        >
            {/* Action buttons */}
            {actions.map((action, index) => {
                const { x, y } = getActionPosition(index, actions.length);
                return (
                    <button
                        key={action.label}
                        onClick={() => {
                            action.onClick();
                            setIsOpen(false);
                        }}
                        className={cn(
                            'absolute flex items-center justify-center w-12 h-12 rounded-full border border-border/30 shadow-lg text-foreground transition-all duration-300 pointer-events-none opacity-0',
                            isOpen && 'pointer-events-auto opacity-100'
                        )}
                        style={{
                            transform: isOpen
                                ? `translate(${x}px, ${y}px) scale(1)`
                                : 'translate(0, 0) scale(0)',
                            transitionDelay: isOpen ? `${index * 50}ms` : '0ms',
                            backgroundColor: action.color || 'hsl(var(--card))',
                            color: action.color ? 'white' : 'hsl(var(--foreground))'
                        }}
                        title={action.label}
                        aria-label={action.label}
                    >
                        {action.icon}
                    </button>
                );
            })}

            {/* Labels */}
            {isOpen && actions.map((action, index) => {
                const { x, y } = getActionPosition(index, actions.length);
                return (
                    <span
                        key={`label-${action.label}`}
                        className="absolute px-2 py-1 rounded-md bg-popover/95 text-popover-foreground typo-overline font-medium whitespace-nowrap pointer-events-none animate-in fade-in duration-300"
                        style={{
                            transform: `translate(${x}px, ${y + 35}px)`
                        }}
                    >
                        {action.label}
                    </span>
                );
            })}

            {/* Main FAB button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "relative flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95",
                    isOpen && "rotate-90 bg-destructive shadow-destructive/20"
                )}
                aria-label={isOpen ? t('fab.closeMenu') : t('fab.openMenu')}
                aria-expanded={isOpen}
            >
                {isOpen ? closeIcon : mainIcon}
            </button>
        </div>
    );
};

FloatingActionButton.displayName = 'FloatingActionButton';
