import { useLanguage } from '@renderer/i18n';
import React, { useRef } from 'react';

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
    setIsSidebarCollapsed: _setIsSidebarCollapsed,
}) => {
    const { theme } = useTheme();
    const { isRTL } = useLanguage();
    const containerRef = useRef<HTMLDivElement>(null);
    const effectiveSidebarWidth = isSidebarCollapsed ? 60 : 280;

    return (
        <div
            ref={containerRef}
            dir={isRTL ? 'rtl' : 'ltr'}
            className={cn(
                'fixed inset-0 flex overflow-hidden bg-background text-foreground',
                theme
            )}
        >
            {/* Sidebar */}
            <div
                className="h-full flex-shrink-0 z-20 bg-background border-e border-border"
                style={{ width: effectiveSidebarWidth }}
            >
                {sidebarContent}
            </div>

            {/* Main Content */}
            <div className="flex-1 h-full min-w-0 flex flex-col overflow-hidden">
                {showPanel && panelContent ? (
                    <>
                        <div className="flex-1 min-h-0 overflow-hidden">{mainContent}</div>
                        <div className="h-px bg-border/50" />
                        <div className="h-1/4 min-h-[100px] bg-card border-t border-border overflow-hidden">
                            {panelContent}
                        </div>
                    </>
                ) : (
                    <div className="h-full w-full flex flex-col overflow-hidden">{mainContent}</div>
                )}
            </div>
        </div>
    );
};

LayoutManager.displayName = 'LayoutManager';
