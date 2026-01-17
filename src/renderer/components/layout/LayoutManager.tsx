import React, { useCallback, useEffect, useRef, useState } from 'react';

import { useTheme } from '@/context/ThemeContext';
import { cn } from '@/lib/utils';

interface LayoutManagerProps {
    sidebarContent: React.ReactNode;
    mainContent: React.ReactNode;
    panelContent?: React.ReactNode;
    showPanel?: boolean;
    isSidebarCollapsed?: boolean;
    setIsSidebarCollapsed?: (collapsed: boolean) => void;
}

export const LayoutManager: React.FC<LayoutManagerProps> = ({
    sidebarContent,
    mainContent,
    panelContent,
    showPanel = false,
    isSidebarCollapsed = false,
    setIsSidebarCollapsed,
}) => {
    const { theme } = useTheme();
    const containerRef = useRef<HTMLDivElement>(null);
    const [sidebarWidth, setSidebarWidth] = useState(() => {
        if (isSidebarCollapsed) { return 60; }
        const savedWidth = localStorage.getItem('sidebarWidth');
        return savedWidth ? parseInt(savedWidth, 10) || 280 : 280;
    });
    const [isDragging, setIsDragging] = useState(false);
    const startXRef = useRef(0);
    const startWidthRef = useRef(0);

    React.useLayoutEffect(() => {
        const targetWidth = isSidebarCollapsed ? 60 : (parseInt(localStorage.getItem('sidebarWidth') ?? '280', 10));
        if (sidebarWidth !== targetWidth) {
            setSidebarWidth(targetWidth);
        }
    }, [isSidebarCollapsed, sidebarWidth]);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setIsDragging(true);
        startXRef.current = e.clientX;
        startWidthRef.current = sidebarWidth;
    }, [sidebarWidth]);

    useEffect(() => {
        if (!isDragging) { return; }

        const handleMouseMove = (e: MouseEvent) => {
            const SNAP_POINTS = [280, 400, 600];
            const SNAP_THRESHOLD = 15;

            const delta = e.clientX - startXRef.current;
            const maxWidth = Math.min(window.innerWidth * 0.4, 800); // Max 40% or 800px
            let newWidth = Math.max(60, Math.min(maxWidth, startWidthRef.current + delta));

            // Magnetic Snapping
            for (const point of SNAP_POINTS) {
                if (Math.abs(newWidth - point) < SNAP_THRESHOLD) {
                    newWidth = point;
                    break;
                }
            }

            setSidebarWidth(newWidth);

            if (setIsSidebarCollapsed) {
                if (newWidth < 100 && !isSidebarCollapsed) {
                    setIsSidebarCollapsed(true);
                } else if (newWidth >= 100 && isSidebarCollapsed) {
                    setIsSidebarCollapsed(false);
                }
            }
        };

        const handleMouseUp = () => {
            setIsDragging(false);
            if (!isSidebarCollapsed) {
                localStorage.setItem('sidebarWidth', sidebarWidth.toString());
            }
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, isSidebarCollapsed, setIsSidebarCollapsed, sidebarWidth]);

    return (
        <div
            ref={containerRef}
            className={cn("fixed inset-0 flex overflow-hidden bg-background text-foreground", theme)}
        >
            {/* Sidebar */}
            <div
                className="h-full flex-shrink-0 z-20 bg-background border-r border-border"
                style={{ width: sidebarWidth }}
            >
                {sidebarContent}
            </div>

            {/* Resize Handle */}
            <div
                tabIndex={0}
                role="separator"
                aria-valuenow={sidebarWidth}
                aria-valuemin={60}
                aria-valuemax={800}
                onMouseDown={handleMouseDown}
                onKeyDown={(e) => {
                    const step = e.shiftKey ? 50 : 10;
                    if (e.key === 'ArrowLeft') {
                        const newWidth = Math.max(60, sidebarWidth - step);
                        setSidebarWidth(newWidth);
                        localStorage.setItem('sidebarWidth', newWidth.toString());
                    } else if (e.key === 'ArrowRight') {
                        const newWidth = Math.min(800, sidebarWidth + step);
                        setSidebarWidth(newWidth);
                        localStorage.setItem('sidebarWidth', newWidth.toString());
                    } else if (e.key === 'Enter' || e.key === ' ') {
                        if (setIsSidebarCollapsed) {
                            setIsSidebarCollapsed(!isSidebarCollapsed);
                        }
                    }
                }}
                onDoubleClick={() => {
                    setSidebarWidth(280);
                    localStorage.setItem('sidebarWidth', '280');
                    if (isSidebarCollapsed && setIsSidebarCollapsed) {
                        setIsSidebarCollapsed(false);
                    }
                }}
                className={cn(
                    "w-4 -ml-2 relative z-50 cursor-col-resize flex flex-col justify-center items-center group outline-none select-none touch-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-sm",
                )}
            >
                {/* Visible Line */}
                <div className={cn(
                    "w-[1px] h-full bg-border/0 transition-all duration-300 ease-out",
                    "group-hover:bg-primary/50 group-active:bg-primary",
                    "group-focus-visible:bg-primary/50",
                    isDragging && "bg-primary w-[2px] shadow-none"
                )} />
            </div>

            {/* Main Content */}
            <div className="flex-1 h-full min-w-0 flex flex-col overflow-hidden">
                {showPanel && panelContent ? (
                    <>
                        <div className="flex-1 min-h-0 overflow-hidden">
                            {mainContent}
                        </div>
                        <div className="h-px bg-border/50" />
                        <div className="h-1/4 min-h-[100px] bg-card border-t border-border overflow-hidden">
                            {panelContent}
                        </div>
                    </>
                ) : (
                    <div className="h-full w-full flex flex-col overflow-hidden">
                        {mainContent}
                    </div>
                )}
            </div>
        </div>
    );
};
