import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { cn } from '@/lib/utils';

export interface TooltipProps {
    children: React.ReactElement
    content: string | React.ReactNode
    side?: 'top' | 'bottom' | 'left' | 'right'
    delay?: number
    disabled?: boolean
    className?: string
}

export function Tooltip({
    children,
    content,
    side = 'top',
    delay = 300,
    disabled = false,
    className
}: TooltipProps) {
    const [isVisible, setIsVisible] = useState(false);
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const triggerRef = useRef<HTMLElement | null>(null);
    const tooltipRef = useRef<HTMLDivElement | null>(null);

    const showTooltip = () => {
        if (disabled) { return; }
        timeoutRef.current = setTimeout(() => {
            setIsVisible(true);
            updatePosition();
        }, delay);
    };

    const hideTooltip = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        setIsVisible(false);
    };

    const updatePosition = useCallback(() => {
        if (!triggerRef.current || !tooltipRef.current) { return; }

        const triggerRect = triggerRef.current.getBoundingClientRect();
        const tooltipRect = tooltipRef.current.getBoundingClientRect();
        const gap = 8;

        let top = 0;
        let left = 0;

        switch (side) {
            case 'top':
                top = triggerRect.top - tooltipRect.height - gap;
                left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
                break;
            case 'bottom':
                top = triggerRect.bottom + gap;
                left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
                break;
            case 'left':
                top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
                left = triggerRect.left - tooltipRect.width - gap;
                break;
            case 'right':
                top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
                left = triggerRect.right + gap;
                break;
        }

        // Keep tooltip within viewport
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        if (left < 0) { left = gap; }
        if (left + tooltipRect.width > viewportWidth) {
            left = viewportWidth - tooltipRect.width - gap;
        }
        if (top < 0) { top = gap; }
        if (top + tooltipRect.height > viewportHeight) {
            top = viewportHeight - tooltipRect.height - gap;
        }

        setPosition({ top, left });
    }, [side]);

    useEffect(() => {
        if (isVisible) {
            updatePosition();
            const handleResize = () => updatePosition();
            const handleScroll = () => updatePosition();
            window.addEventListener('resize', handleResize);
            window.addEventListener('scroll', handleScroll, true);
            return () => {
                window.removeEventListener('resize', handleResize);
                window.removeEventListener('scroll', handleScroll, true);
            };
        }
        return undefined;
    }, [isVisible, side, updatePosition]);

    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    // Clone element and add event handlers - use type assertion for ref handling
    const childProps = children.props as { ref?: React.Ref<HTMLElement> };
    const trigger = React.cloneElement(children, {
        ref: (node: HTMLElement | null) => {
            triggerRef.current = node;
            // Forward ref to original element if it exists
            const originalRef = childProps.ref;
            if (typeof originalRef === 'function') {
                originalRef(node);
            } else if (originalRef && typeof originalRef === 'object') {
                // eslint-disable-next-line react-hooks/immutability
                (originalRef as React.MutableRefObject<HTMLElement | null>).current = node;
            }
        },
        onMouseEnter: showTooltip,
        onMouseLeave: hideTooltip,
        onFocus: showTooltip,
        onBlur: hideTooltip,
    });

    return (
        <>
            {trigger}
            {isVisible && createPortal(
                <div
                    ref={tooltipRef}
                    className={cn(
                        "absolute z-[9999] px-2 py-1.5 text-xs font-medium text-foreground bg-zinc-900 border border-white/10 rounded-md shadow-lg pointer-events-none",
                        "animate-in fade-in-0 zoom-in-95 duration-200",
                        className
                    )}
                    style={{
                        top: `${position.top}px`,
                        left: `${position.left}px`,
                    }}
                    role="tooltip"
                >
                    {content}
                    <div
                        className={cn(
                            "absolute w-2 h-2 bg-zinc-900 border-white/10 rotate-45",
                            side === 'top' && "bottom-[-4px] left-1/2 -translate-x-1/2 border-r border-b",
                            side === 'bottom' && "top-[-4px] left-1/2 -translate-x-1/2 border-l border-t",
                            side === 'left' && "right-[-4px] top-1/2 -translate-y-1/2 border-r border-t",
                            side === 'right' && "left-[-4px] top-1/2 -translate-y-1/2 border-l border-b"
                        )}
                    />
                </div>,
                document.body
            )}
        </>
    );
}
