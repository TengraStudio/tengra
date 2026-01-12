import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ResizableContainer, ResizablePane, ResizableHandle } from './SimpleResizable';
import { cn } from '@/lib/utils';
import { useTheme } from '@/context/ThemeContext';

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
    const [sidebarSize, setSidebarSize] = useState(isSidebarCollapsed ? 4 : 15);
    const [mainSize, setMainSize] = useState(showPanel && panelContent ? 75 : 100);

    useEffect(() => {
        setSidebarSize(isSidebarCollapsed ? 4 : 15);
    }, [isSidebarCollapsed]);

    useEffect(() => {
        setMainSize(showPanel && panelContent ? 75 : 100);
    }, [showPanel, panelContent]);

    const handleSidebarResize = useCallback((delta: number) => {
        if (!containerRef.current) return;
        const containerWidth = containerRef.current.offsetWidth;
        const deltaPercent = (delta / containerWidth) * 100;
        setSidebarSize(prevSize => {
            const newSize = Math.max(3, Math.min(25, prevSize + deltaPercent));
            
            if (setIsSidebarCollapsed) {
                if (newSize < 8 && !isSidebarCollapsed) {
                    setIsSidebarCollapsed(true);
                } else if (newSize > 8 && isSidebarCollapsed) {
                    setIsSidebarCollapsed(false);
                }
            }
            
            return newSize;
        });
    }, [isSidebarCollapsed, setIsSidebarCollapsed]);

    const handleMainResize = useCallback((delta: number) => {
        if (!containerRef.current) return;
        const containerHeight = containerRef.current.offsetHeight;
        const deltaPercent = (delta / containerHeight) * 100;
        setMainSize(prevSize => Math.max(50, Math.min(90, prevSize + deltaPercent)));
    }, []);

    return (
        <div 
            ref={containerRef}
            className={cn("flex h-screen w-full overflow-hidden bg-background text-foreground", theme)}
        >
            <ResizableContainer direction="horizontal" className="h-full w-full">
                {/* Sidebar Panel */}
                <ResizablePane
                    initialSize={sidebarSize}
                    className={cn(
                        "z-20 bg-card/10 backdrop-blur-md flex flex-col"
                    )}
                >
                    {sidebarContent}
                </ResizablePane>
                
                <ResizableHandle onResize={handleSidebarResize} direction="horizontal" />
                
                {/* Main Content Panel */}
                <ResizablePane
                    initialSize={100 - sidebarSize}
                    className="flex flex-col min-h-0"
                >
                    <ResizableContainer direction="vertical" className="h-full">
                        <ResizablePane
                            initialSize={mainSize}
                            className="flex flex-col min-h-0"
                        >
                            {mainContent}
                        </ResizablePane>

                        {showPanel && panelContent && (
                            <>
                                <ResizableHandle onResize={handleMainResize} direction="vertical" />
                                <ResizablePane
                                    initialSize={100 - mainSize}
                                    className="bg-card/5 backdrop-blur-sm border-t border-border/50"
                                >
                                    {panelContent}
                                </ResizablePane>
                            </>
                        )}
                    </ResizableContainer>
                </ResizablePane>
            </ResizableContainer>
        </div>
    );
};
