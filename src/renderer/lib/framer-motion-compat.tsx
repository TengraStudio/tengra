/**
 * Compatibility layer for framer-motion -> react-transition-group migration
 * This provides a drop-in replacement for framer-motion's motion and AnimatePresence components
 */

import React from 'react'
import { CSSTransition, TransitionGroup } from 'react-transition-group'

// Type definitions matching framer-motion's API
export interface MotionProps extends React.HTMLAttributes<HTMLElement> {
    initial?: any
    animate?: any
    exit?: any
    transition?: any
    whileHover?: any
    whileTap?: any
    layout?: boolean
    variants?: any
    custom?: any
    children?: React.ReactNode
    style?: React.CSSProperties
    className?: string
    onClick?: (e?: React.MouseEvent) => void
    onMouseEnter?: (e?: React.MouseEvent) => void
    onMouseLeave?: (e?: React.MouseEvent) => void
}

export interface AnimatePresenceProps {
    children: React.ReactNode
    mode?: 'sync' | 'wait' | 'popLayout'
    initial?: boolean
    onExitComplete?: () => void
}

// Convert framer-motion style props to CSS
function convertStyleProps(props: any): React.CSSProperties {
    if (!props || typeof props !== 'object') return {}
    
    const styles: React.CSSProperties = {}
    
    if (props.opacity !== undefined) styles.opacity = props.opacity
    if (props.scale !== undefined) styles.transform = `scale(${props.scale})`
    if (props.x !== undefined) styles.transform = `translateX(${props.x}px)`
    if (props.y !== undefined) styles.transform = `translateY(${props.y}px)`
    if (props.rotate !== undefined) styles.transform = `rotate(${props.rotate}deg)`
    
    // Handle combined transforms
    if (props.scale !== undefined && (props.x !== undefined || props.y !== undefined || props.rotate !== undefined)) {
        const transforms: string[] = []
        if (props.scale !== undefined) transforms.push(`scale(${props.scale})`)
        if (props.x !== undefined) transforms.push(`translateX(${props.x}px)`)
        if (props.y !== undefined) transforms.push(`translateY(${props.y}px)`)
        if (props.rotate !== undefined) transforms.push(`rotate(${props.rotate}deg)`)
        styles.transform = transforms.join(' ')
    }
    
    if (props.height !== undefined) {
        if (props.height === 'auto') {
            styles.height = 'auto'
        } else {
            styles.height = typeof props.height === 'string' ? props.height : `${props.height}px`
        }
    }
    
    return styles
}

// Convert transition config to CSS transition duration
function getTransitionDuration(transition: any): number {
    if (!transition) return 300
    if (typeof transition === 'number') return transition
    if (transition.duration) return transition.duration
    return 300
}

// Motion component - replacement for framer-motion's motion.div, motion.button, etc.
export const motion = new Proxy({} as any, {
    get: (_, tag: string) => {
        return React.forwardRef<any, MotionProps>((props, ref) => {
            const {
                initial,
                animate,
                exit,
                transition,
                whileHover,
                whileTap,
                layout: _layout,
                variants: _variants,
                custom: _custom,
                children,
                style = {},
                className,
                onClick,
                onMouseEnter,
                onMouseLeave,
                ...restProps
            } = props

            // Convert animation props to CSS
            const initialStyles = convertStyleProps(initial || {})
            const animateStyles = convertStyleProps(animate || {})
            const hoverStyles = convertStyleProps(whileHover || {})
            
            // Merge styles
            const baseStyle: React.CSSProperties = {
                ...initialStyles,
                ...animateStyles,
                ...style,
                transition: `all ${getTransitionDuration(transition)}ms ease-in-out`
            }
            
            // Handle hover state
            const [isHovered, setIsHovered] = React.useState(false)
            const [isTapped, setIsTapped] = React.useState(false)
            
            const finalStyle: React.CSSProperties = {
                ...baseStyle,
                ...(isHovered ? hoverStyles : {}),
                ...(isTapped ? convertStyleProps(whileTap || {}) : {})
            }
            
            const handleMouseEnter = React.useCallback((e: React.MouseEvent) => {
                if (whileHover) {
                    setIsHovered(true)
                }
                if (onMouseEnter) {
                    onMouseEnter(e)
                }
            }, [whileHover, onMouseEnter])

            const handleMouseLeave = React.useCallback((e: React.MouseEvent) => {
                if (whileHover) {
                    setIsHovered(false)
                }
                if (onMouseLeave) {
                    onMouseLeave(e)
                }
            }, [whileHover, onMouseLeave])

            const handleClick = React.useCallback((e: React.MouseEvent) => {
                if (whileTap) {
                    setIsTapped(true)
                    setTimeout(() => setIsTapped(false), 150)
                }
                if (onClick) {
                    onClick(e)
                }
            }, [whileTap, onClick])
            
            // Handle height: 'auto' specially
            const elementRef = React.useRef<HTMLElement | null>(null)
            const needsHeightAnimation = animate?.height === 'auto' || initial?.height === 'auto'
            const [height, setHeight] = React.useState<number | 'auto'>(
                needsHeightAnimation ? (initial?.height === 0 ? 0 : 'auto') : (finalStyle.height as number || 'auto')
            )
            
            React.useEffect(() => {
                if (needsHeightAnimation && elementRef.current) {
                    const measuredHeight = elementRef.current.scrollHeight
                    setHeight(measuredHeight)
                }
            }, [children, needsHeightAnimation])
            
            React.useEffect(() => {
                if (!needsHeightAnimation) return
                
                const observer = new ResizeObserver(() => {
                    if (elementRef.current) {
                        const measuredHeight = elementRef.current.scrollHeight
                        setHeight(measuredHeight)
                    }
                })
                
                if (elementRef.current) {
                    observer.observe(elementRef.current)
                }
                
                return () => observer.disconnect()
            }, [needsHeightAnimation])
            
            if (needsHeightAnimation) {
                finalStyle.height = typeof height === 'number' ? `${height}px` : height
                finalStyle.overflow = 'hidden'
            }

            // Create the element
            const Element = tag || 'div'

            return React.createElement(
                Element,
                {
                    ref: (node: any) => {
                        if (needsHeightAnimation && node) {
                            elementRef.current = node
                        }
                        if (typeof ref === 'function') {
                            ref(node)
                        } else if (ref) {
                            (ref as any).current = node
                        }
                    },
                    style: finalStyle,
                    className,
                    onClick: handleClick,
                    onMouseEnter: handleMouseEnter,
                    onMouseLeave: handleMouseLeave,
                    ...restProps
                } as any,
                children
            )
        })
    }
})

// AnimatePresence component - replacement for framer-motion's AnimatePresence
export const AnimatePresence: React.FC<AnimatePresenceProps> = ({ 
    children, 
    mode: _mode = 'sync',
    initial: _initial = true,
    onExitComplete 
}) => {
    // Track when children are removed
    const prevChildrenRef = React.useRef<React.ReactNode>(children)
    React.useEffect(() => {
        const hadChildren = !!prevChildrenRef.current
        const hasChildren = !!children
        
        if (onExitComplete && hadChildren && !hasChildren) {
            // Children were removed, wait a bit for exit animations then call callback
            const timer = setTimeout(() => {
                onExitComplete()
            }, 300) // Give time for exit animations
            
            return () => clearTimeout(timer)
        }
        
        // Update ref
        const updateRef = () => {
            (prevChildrenRef as any).current = children
        }
        updateRef()
    }, [children, onExitComplete])
    
    // Use TransitionGroup for enter/exit animations
    return (
        <TransitionGroup component={null}>
            {React.Children.map(children, (child, index) => {
                if (!child) return null
                
                return (
                    <CSSTransition
                        key={typeof child === 'object' && 'key' in child ? child.key : index}
                        timeout={300}
                        classNames="fade"
                        onExited={onExitComplete}
                    >
                        <div>{child}</div>
                    </CSSTransition>
                )
            })}
        </TransitionGroup>
    )
}

// Export default for compatibility
export default { motion, AnimatePresence }
