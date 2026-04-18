/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * Simplified compatibility layer for framer-motion
 * Uses CSS transitions instead of JS animations
 */

import React, { FC, ForwardRefExoticComponent, memo, RefAttributes } from 'react';

// Type definitions matching framer-motion's API
export interface MotionProps extends React.HTMLAttributes<HTMLElement> {
    initial?: Record<string, RendererDataValue>
    animate?: Record<string, RendererDataValue>
    exit?: Record<string, RendererDataValue>
    transition?: Record<string, RendererDataValue>
    whileHover?: Record<string, RendererDataValue>
    whileTap?: Record<string, RendererDataValue>
    layout?: boolean
    variants?: Record<string, RendererDataValue>
    custom?: RendererDataValue
    children?: React.ReactNode
    style?: React.CSSProperties
    className?: string
}

export interface AnimatePresenceProps {
    children: React.ReactNode
    mode?: 'sync' | 'wait' | 'popLayout'
    initial?: boolean
    onExitComplete?: () => void
}

// Simple motion component - just renders the element with CSS transition classes
const createMotionComponent = (tag: string) => {
    const MotionComponent = React.forwardRef<HTMLElement, MotionProps>(({ initial: _initial, animate: _animate, exit: _exit, transition: _transition, whileHover: _whileHover, whileTap: _whileTap, layout: _layout, variants: _variants, custom: _custom, children, style, className, ...restProps }, ref) => {

        return React.createElement(
            tag,
            {
                ref,
                style: {
                    ...style,
                    transition: 'all 0.2s ease-in-out'
                },
                className,
                ...restProps
            },
            children
        );
    });

    MotionComponent.displayName = `motion.${tag}`;
    return MotionComponent;
};

// Cache for motion components
const motionComponentCache: Record<string, ForwardRefExoticComponent<MotionProps & RefAttributes<HTMLElement>>> = {};

// Motion proxy that creates components on demand
export const motion = new Proxy({} as Record<string, ForwardRefExoticComponent<MotionProps & RefAttributes<HTMLElement>>>, {
    get: (_, tag: string | symbol) => {
        if (typeof tag !== 'string') {
            return undefined;
        }
        if (!(tag in motionComponentCache)) {
            motionComponentCache[tag] = createMotionComponent(tag) as TypeAssertionValue as ForwardRefExoticComponent<MotionProps & RefAttributes<HTMLElement>>;
        }
        return motionComponentCache[tag];
    }
});

// Simple AnimatePresence - just renders children directly
export const AnimatePresence: FC<AnimatePresenceProps> = memo(({ children, mode: _mode = 'sync', initial: _initial = true, onExitComplete: _onExitComplete }) => {
    return <>{children}</>;
});

AnimatePresence.displayName = 'AnimatePresence';

export default { motion, AnimatePresence };
