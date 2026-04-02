/**
 * Simple CSS-based Resizable Layout
 * No external dependencies, no useLayoutEffect issues
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

import './simple-resizable.css';

// Removed duplicate interface

interface ResizableContainerProps {
    children: React.ReactNode;
    direction?: 'horizontal' | 'vertical';
    className?: string;
}

export interface ResizablePaneProps {
    children: React.ReactNode;
    initialSize?: number;
    className?: string;
    onResize?: (size: number) => void;
    direction?: 'horizontal' | 'vertical'; // Add direction prop
}

export const ResizablePane: React.FC<ResizablePaneProps> = ({
    children,
    initialSize = 50,
    className,
    onResize,
    direction = 'horizontal',
}) => {
    const [size, setSize] = useState(initialSize);
    const containerRef = useRef<HTMLDivElement>(null);

    // Update size when initialSize changes
    useEffect(() => {
        setSize(initialSize);
    }, [initialSize]);

    useEffect(() => {
        if (onResize) {
            onResize(size);
        }
    }, [size, onResize]);

    return (
        <div
            ref={containerRef}
            className={cn('tengra-resizable-pane', className)}
            style={{
                width: direction === 'horizontal' ? `${size}%` : '100%',
                height: direction === 'vertical' ? `${size}%` : '100%',
                flexShrink: 0,
                flexGrow: 0,
            }}
        >
            {children}
        </div>
    );
};

export const ResizableHandle: React.FC<{
    onResize: (delta: number) => void;
    direction?: 'horizontal' | 'vertical';
    className?: string;
}> = ({ onResize, direction = 'horizontal', className }) => {
    const [isDragging, setIsDragging] = useState(false);
    const startPosRef = useRef<number>(0);

    const handleMouseDown = useCallback(
        (e: React.MouseEvent) => {
            e.preventDefault();
            setIsDragging(true);
            startPosRef.current = direction === 'horizontal' ? e.clientX : e.clientY;
        },
        [direction]
    );

    useEffect(() => {
        if (!isDragging) {
            return;
        }

        const handleMouseMove = (e: MouseEvent) => {
            const currentPos = direction === 'horizontal' ? e.clientX : e.clientY;
            const delta = currentPos - startPosRef.current;
            onResize(delta);
            startPosRef.current = currentPos; // Update start position for next move
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, direction, onResize]);

    return (
        <div
            onMouseDown={handleMouseDown}
            className={cn(
                'tengra-resizable-handle',
                direction === 'horizontal' ? 'tengra-resizable-handle--horizontal' : 'tengra-resizable-handle--vertical',
                isDragging && 'tengra-resizable-handle--dragging',
                className
            )}
            style={{
                width: direction === 'horizontal' ? undefined : '100%',
                height: direction === 'vertical' ? undefined : '100%',
                flexShrink: 0,
            }}
        >
            <div
                className={cn(
                    'tengra-resizable-handle__indicator',
                    direction === 'horizontal'
                        ? 'tengra-resizable-handle__indicator--horizontal'
                        : 'tengra-resizable-handle__indicator--vertical'
                )}
            />
        </div>
    );
};

export const ResizableContainer: React.FC<ResizableContainerProps> = ({
    children,
    direction = 'horizontal',
    className,
}) => {
    return (
        <div
            className={cn(
                'tengra-resizable-container',
                direction === 'horizontal' ? 'tengra-resizable-container--horizontal' : 'tengra-resizable-container--vertical',
                className
            )}
        >
            {children}
        </div>
    );
};

ResizablePane.displayName = 'ResizablePane';
ResizableHandle.displayName = 'ResizableHandle';
ResizableContainer.displayName = 'ResizableContainer';
