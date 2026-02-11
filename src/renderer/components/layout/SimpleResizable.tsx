/**
 * Simple CSS-based Resizable Layout
 * No external dependencies, no useLayoutEffect issues
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

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
            className={cn('overflow-hidden', className)}
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
                'bg-transparent hover:bg-primary/20 transition-colors cursor-col-resize flex items-center justify-center group z-50',
                direction === 'vertical' && 'cursor-row-resize',
                isDragging && 'bg-primary/30',
                className
            )}
            style={{
                width: direction === 'horizontal' ? '4px' : '100%',
                height: direction === 'vertical' ? '4px' : '100%',
                flexShrink: 0,
            }}
        >
            <div
                className={cn(
                    'rounded-full bg-border/50 group-hover:bg-primary/50 transition-colors',
                    direction === 'horizontal' ? 'h-8 w-1' : 'w-8 h-1'
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
                'flex w-full h-full',
                direction === 'horizontal' ? 'flex-row' : 'flex-col',
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
