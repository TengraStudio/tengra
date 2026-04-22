/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { getAnimationDurationMs, usePrefersReducedMotion } from '@/lib/animation-system';
import { cn } from '@/lib/utils';
import { trackTooltipHidden, trackTooltipShown } from '@/store/tooltip-analytics.store';

import {
    resolveTooltipPosition,
    TooltipPosition,
    TooltipSide,
} from './tooltip-utils';


export interface TooltipProps {
    children: React.ReactElement;
    content: string | React.ReactNode;
    id?: string;
    title?: string;
    description?: React.ReactNode;
    shortcut?: string;
    side?: TooltipSide;
    sideOffset?: number;
    delay?: number;
    closeDelay?: number;
    disabled?: boolean;
    maxWidthClassName?: string;
    className?: string;
}

type TooltipTriggerElement = HTMLElement;
type TooltipFocusEvent = React.FocusEvent<TooltipTriggerElement>;
type TooltipMouseEvent = React.MouseEvent<TooltipTriggerElement>;
type TooltipFocusHandler = ((event: TooltipFocusEvent) => void) | undefined;
type TooltipMouseHandler = ((event: TooltipMouseEvent) => void) | undefined;

function composeMouseHandlers(
    childHandler: TooltipMouseHandler,
    tooltipHandler: () => void
): (event: TooltipMouseEvent) => void {
    return event => {
        childHandler?.(event);
        if (!event.defaultPrevented) {
            tooltipHandler();
        }
    };
}

function composeFocusHandlers(
    childHandler: TooltipFocusHandler,
    tooltipHandler: () => void
): (event: TooltipFocusEvent) => void {
    return event => {
        childHandler?.(event);
        if (!event.defaultPrevented) {
            tooltipHandler();
        }
    };
}

export function Tooltip({
    children,
    content,
    id,
    title,
    description,
    shortcut,
    side = 'top',
    sideOffset = 8,
    delay = 300,
    closeDelay = 70,
    disabled = false,
    maxWidthClassName = 'max-w-72',
    className,
}: TooltipProps) {
    const [isVisible, setIsVisible] = useState(false);
    const [position, setPosition] = useState<TooltipPosition>({ top: 0, left: 0 });
    const [resolvedSide, setResolvedSide] = useState<TooltipSide>(side);
    const timeoutRef = useRef<number | null>(null);
    const hideTimeoutRef = useRef<number | null>(null);
    const triggerRef = useRef<HTMLElement | null>(null);
    const tooltipRef = useRef<HTMLDivElement | null>(null);
    const wasVisibleRef = useRef(false);
    const tooltipId = id ?? `tooltip-${side}-${String(content).slice(0, 12)}`;
    const prefersReducedMotion = usePrefersReducedMotion();
    const animationDurationMs = getAnimationDurationMs('tooltip', prefersReducedMotion);

    const showTooltip = () => {
        if (disabled) {
            return;
        }
        if (hideTimeoutRef.current !== null) {
            window.clearTimeout(hideTimeoutRef.current);
            hideTimeoutRef.current = null;
        }
        timeoutRef.current = window.setTimeout(() => {
            setIsVisible(true);
            updatePosition();
        }, delay);
    };

    const hideTooltip = () => {
        if (timeoutRef.current) {
            window.clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        hideTimeoutRef.current = window.setTimeout(() => {
            setIsVisible(false);
        }, closeDelay);
    };

    const updatePosition = useCallback(() => {
        if (!triggerRef.current || !tooltipRef.current) {
            return;
        }

        const triggerRect = triggerRef.current.getBoundingClientRect();
        const tooltipRect = tooltipRef.current.getBoundingClientRect();
        const gap = sideOffset;

        const resolved = resolveTooltipPosition({
            preferredSide: side,
            triggerRect,
            tooltipRect,
            gap,
        });
        setResolvedSide(resolved.side);
        setPosition(resolved.position);
    }, [side, sideOffset]);

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
        if (isVisible && !wasVisibleRef.current) {
            trackTooltipShown(tooltipId, resolvedSide);
        }
        if (!isVisible && wasVisibleRef.current) {
            trackTooltipHidden(tooltipId, resolvedSide);
        }
        wasVisibleRef.current = isVisible;
    }, [isVisible, resolvedSide, tooltipId]);

    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                window.clearTimeout(timeoutRef.current);
            }
            if (hideTimeoutRef.current) {
                window.clearTimeout(hideTimeoutRef.current);
            }
        };
    }, []);

    // Clone element and add event handlers - use type assertion for ref handling
    const childProps = children.props as {
        onMouseEnter?: TooltipMouseHandler
        onMouseLeave?: TooltipMouseHandler
        onFocus?: TooltipFocusHandler
        onBlur?: TooltipFocusHandler
        ref?: React.Ref<HTMLElement>
    };
    const trigger = React.cloneElement(children, {
        ref: (node: HTMLElement | null) => {
            triggerRef.current = node;
            // Forward ref to original element if it exists
            // Access ref safely across React 18/19
            const originalRef = (children as React.ReactElement & { ref?: React.Ref<HTMLElement> }).ref ?? childProps.ref;
            if (typeof originalRef === 'function') {
                originalRef(node);
            } else if (originalRef && typeof originalRef === 'object') {
                // eslint-disable-next-line react-hooks/immutability
                (originalRef as React.MutableRefObject<HTMLElement | null>).current = node;
            }
        },
        onMouseEnter: composeMouseHandlers(childProps.onMouseEnter, showTooltip),
        onMouseLeave: composeMouseHandlers(childProps.onMouseLeave, hideTooltip),
        onFocus: composeFocusHandlers(childProps.onFocus, showTooltip),
        onBlur: composeFocusHandlers(childProps.onBlur, hideTooltip),
    });

    return (
        <>
            {trigger}
            {isVisible &&
                createPortal(
                    <div
                        ref={tooltipRef}
                        className={cn(
                            'absolute z-50 py-2 px-3 text-xs text-foreground bg-popover/95 backdrop-blur-16 border border-border/60 rounded-lg shadow-2xl pointer-events-none',
                            maxWidthClassName,
                            className
                        )}
                        style={{
                            top: `${position.top}px`,
                            left: `${position.left}px`,
                            transition: `opacity ${animationDurationMs}ms ease, transform ${animationDurationMs}ms ease`,
                        }}
                        role="tooltip"
                        aria-live="polite"
                    >
                        <div className="flex flex-col gap-1">
                            {title && <div className="text-xs font-semibold text-foreground">{title}</div>}
                            {typeof content === 'string' ? (
                                <div className="text-muted-foreground">{content}</div>
                            ) : (
                                content
                            )}
                            {description && (
                                <div className="text-10 text-muted-foreground/90">{description}</div>
                            )}
                            {shortcut && (
                                <div className="pt-1">
                                    <kbd className="inline-block px-1.5 py-0.5 font-mono text-10 tracking-50 text-foreground bg-background/70 border border-border/60 rounded">
                                        {shortcut}
                                    </kbd>
                                </div>
                            )}
                        </div>
                        <div
                            className={cn(
                                'absolute w-2 h-2 bg-popover/95 transform rotate-45',
                                resolvedSide === 'top' && '-bottom-1 left-1/2 -translate-x-1/2 border-r border-b border-border/60',
                                resolvedSide === 'bottom' && '-top-1 left-1/2 -translate-x-1/2 border-l border-t border-border/60',
                                resolvedSide === 'left' && '-right-1 top-1/2 -translate-y-1/2 border-r border-t border-border/60',
                                resolvedSide === 'right' && '-left-1 top-1/2 -translate-y-1/2 border-l border-b border-border/60'
                            )}
                        />
                    </div>,
                    document.body
                )}
        </>
    );
}
