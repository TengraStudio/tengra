/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import React from 'react';

import { cn } from '@/lib/utils';


interface TypingIndicatorProps {
    className?: string
    size?: 'sm' | 'md' | 'lg'
    label?: string
}

/**
 * TypingIndicator Component
 * 
 * Shows an animated typing indicator (three bouncing dots) for AI responses.
 * 
 * @example
 * ```tsx
 * <TypingIndicator />
 * <TypingIndicator size="lg" label="AI is thinking..." />
 * ```
 */
export const TypingIndicator: React.FC<TypingIndicatorProps> = React.memo(({
    className,
    size = 'md',
    label
}) => {
    return (
        <div className={cn('flex items-center', className)}>
            <div className="flex items-center">
                <span className={cn(
                    "rounded-full bg-primary/60 animate-typing-bounce",
                    size === 'sm' && "w-1.5 h-1.5 mr-1",
                    size === 'md' && "w-2 h-2 mr-1.5",
                    size === 'lg' && "w-2.5 h-2.5 mr-2"
                )} style={{ animationDelay: '0s' }} />
                <span className={cn(
                    "rounded-full bg-primary/60 animate-typing-bounce",
                    size === 'sm' && "w-1.5 h-1.5 mr-1",
                    size === 'md' && "w-2 h-2 mr-1.5",
                    size === 'lg' && "w-2.5 h-2.5 mr-2"
                )} style={{ animationDelay: '0.2s' }} />
                <span className={cn(
                    "rounded-full bg-primary/60 animate-typing-bounce",
                    size === 'sm' && "w-1.5 h-1.5",
                    size === 'md' && "w-2 h-2",
                    size === 'lg' && "w-2.5 h-2.5"
                )} style={{ animationDelay: '0.4s' }} />
            </div>
            {label && (
                <span className="ml-2 text-sm text-muted-foreground">{label}</span>
            )}
        </div>
    );
});

TypingIndicator.displayName = 'TypingIndicator';

