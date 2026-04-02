import React, { useRef, useState } from 'react';

import { cn } from '@/lib/utils';

import './animated-card.css';

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
 *   <h3>Card Title</h3>
 *   <p>Card content</p>
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
        lift: 'tengra-animated-card--lift',
        glow: 'tengra-animated-card--glow',
        scale: 'tengra-animated-card--scale',
        '3d': 'tengra-animated-card--3d',
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
                'tengra-animated-card',
                effectClasses[hoverEffect],
                onClick && 'tengra-animated-card--clickable',
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
        <div className={cn('tengra-gradient-border-card', className)}>
            <div className="tengra-gradient-border-card__inner">
                {children}
            </div>
        </div>
    );
};

GradientBorderCard.displayName = 'GradientBorderCard';
