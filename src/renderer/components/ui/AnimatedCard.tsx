/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import React, { useRef, useState } from 'react';

import { cn } from '@/lib/utils';


interface AnimatedCardProps {
    children: React.ReactNode
    className?: string
    hoverEffect?: 'lift' | 'glow' | 'scale' | '3d' | 'none'
    onClick?: () => void
    as?: 'div' | 'button' | 'article'
}

/**
 * AnimatedCard Component
 * 
 * A card component with various hover animations.
 * 
 * @example
 * ```tsx
 * <AnimatedCard hoverEffect="3d">
 * <h3>Card Title</h3>
 * <p>Card content</p>
 * </AnimatedCard>
 * ```
 */
export const AnimatedCard: React.FC<AnimatedCardProps> = ({
    children,
    className,
    hoverEffect = 'lift',
    onClick,
    as: Component = 'div'
}) => {
    const [rotation, setRotation] = useState({ x: 0, y: 0 });
    const cardRef = useRef<HTMLElement>(null);

    const handleMouseMove = (e: React.MouseEvent) => {
        if (hoverEffect !== '3d') { return; }

        const card = cardRef.current;
        if (!card) { return; }

        const rect = card.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const rotateX = (e.clientY - centerY) / 20;
        const rotateY = (centerX - e.clientX) / 20;

        setRotation({ x: rotateX, y: rotateY });
    };

    const handleMouseLeave = () => {
        setRotation({ x: 0, y: 0 });
    };

    const effectClasses = {
        lift: 'hover:-translate-y-1 hover:shadow-lg',
        glow: 'hover:shadow-glow-primary-hsl',
        scale: 'hover:scale-102',
        '3d': 'transform-3d',
        none: ''
    };

    const style: React.CSSProperties = hoverEffect === '3d' ? {
        transform: `perspective(1000px) rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`,
        transition: 'transform 0.1s ease'
    } : {};

    return (
        <Component
            ref={(node: HTMLElement | null) => {
                (cardRef as React.MutableRefObject<HTMLElement | null>).current = node;
            }}
            className={cn(
                'p-4 rounded-xl border bg-card text-card-foreground transition-all duration-200',
                effectClasses[hoverEffect],
                onClick && 'cursor-pointer',
                className
            )}
            onClick={onClick}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={style}
        >
            {children}
        </Component>
    );
};

AnimatedCard.displayName = 'AnimatedCard';

/**
 * GradientBorderCard Component
 * 
 * A card with an animated gradient border.
 */
export const GradientBorderCard: React.FC<{
    children: React.ReactNode
    className?: string
}> = ({ children, className }) => {
    return (
        <div className={cn('p-0.5 rounded-xl bg-gradient-to-tr from-primary via-accent to-info', className)}>
            <div className="h-full rounded-inner-xl bg-card p-4">
                {children}
            </div>
        </div>
    );
};

GradientBorderCard.displayName = 'GradientBorderCard';

