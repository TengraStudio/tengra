/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import React, { useRef,useState } from 'react';

import { cn } from '@/lib/utils';


interface RippleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'default' | 'primary' | 'secondary' | 'ghost' | 'destructive'
    size?: 'sm' | 'md' | 'lg'
    children: React.ReactNode
}

interface Ripple {
    id: number
    x: number
    y: number
    size: number
}

/**
 * RippleButton Component
 * 
 * A button with Material Design-style ripple effect on click.
 * 
 * @example
 * ```tsx
 * <RippleButton variant="primary" onClick={handleClick}>
 *   Click Me
 * </RippleButton>
 * ```
 */
export const RippleButton: React.FC<RippleButtonProps> = ({
    variant = 'default',
    size = 'md',
    children,
    className,
    onClick,
    ...props
}) => {
    const [ripples, setRipples] = useState<Ripple[]>([]);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const rippleIdRef = useRef(0);

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        const button = buttonRef.current;
        if (!button) {return;}

        const rect = button.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const size = Math.max(rect.width, rect.height) * 2;

        const newRipple: Ripple = {
            id: rippleIdRef.current++,
            x,
            y,
            size
        };

        setRipples(prev => [...prev, newRipple]);

        // Remove ripple after animation
        setTimeout(() => {
            setRipples(prev => prev.filter(r => r.id !== newRipple.id));
        }, 600);

        onClick?.(e);
    };

    return (
        <button
            ref={buttonRef}
            onClick={handleClick}
            className={cn(
                'relative overflow-hidden transition-all active:scale-98',
                {
                    'rounded-lg bg-primary text-primary-foreground hover:bg-primary/90': variant === 'default' || variant === 'primary',
                    'rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80': variant === 'secondary',
                    'rounded-lg bg-transparent hover:bg-muted text-foreground': variant === 'ghost',
                    'rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90': variant === 'destructive',
                    'px-3 py-1.5 text-xs': size === 'sm',
                    'px-5 py-2.5 text-sm font-medium': size === 'md',
                    'px-8 py-4 text-base font-bold': size === 'lg',
                },
                className
            )}
            {...props}
        >
            {/* Ripples */}
            {ripples.map(ripple => (
                <span
                    key={ripple.id}
                    className="absolute pointer-events-none rounded-full bg-current opacity-25 animate-ripple"
                    style={{
                        left: ripple.x - ripple.size / 2,
                        top: ripple.y - ripple.size / 2,
                        width: ripple.size,
                        height: ripple.size
                    }}
                />
            ))}
            
            {/* Content */}
            <span className="relative z-10 flex items-center justify-center gap-2">{children}</span>
        </button>
    );
};

RippleButton.displayName = 'RippleButton';
