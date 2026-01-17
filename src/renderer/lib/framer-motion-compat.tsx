/**
 * Simplified compatibility layer for framer-motion
 * Uses CSS transitions instead of JS animations
 */

import * as React from 'react'

// Type definitions matching framer-motion's API
export interface MotionProps extends React.HTMLAttributes<HTMLElement> {
    initial?: Record<string, unknown>
    animate?: Record<string, unknown>
    exit?: Record<string, unknown>
    transition?: Record<string, unknown>
    whileHover?: Record<string, unknown>
    whileTap?: Record<string, unknown>
    layout?: boolean
    variants?: Record<string, unknown>
    custom?: unknown
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
    const MotionComponent = React.forwardRef<HTMLElement, MotionProps>((props, ref) => {
        const {
            initial: _initial,
            animate: _animate,
            exit: _exit,
            transition: _transition,
            whileHover: _whileHover,
            whileTap: _whileTap,
            layout: _layout,
            variants: _variants,
            custom: _custom,
            children,
            style,
            className,
            ...restProps
        } = props

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
        )
    })

    MotionComponent.displayName = `motion.${tag}`
    return MotionComponent
}

// Cache for motion components
const motionComponentCache: Record<string, React.ForwardRefExoticComponent<MotionProps & React.RefAttributes<HTMLElement>>> = {}

// Motion proxy that creates components on demand
export const motion: any = new Proxy({} as any, {
    get: (_, tag: string) => {
        if (!motionComponentCache[tag]) {
            motionComponentCache[tag] = createMotionComponent(tag) as unknown as React.ForwardRefExoticComponent<MotionProps & React.RefAttributes<HTMLElement>>
        }
        return motionComponentCache[tag]
    }
})

// Simple AnimatePresence - just renders children directly
export const AnimatePresence: React.FC<AnimatePresenceProps> = React.memo(({
    children,
    mode: _mode = 'sync',
    initial: _initial = true,
    onExitComplete: _onExitComplete
}) => {
    return <>{children}</>
})

AnimatePresence.displayName = 'AnimatePresence'

export default { motion, AnimatePresence }
