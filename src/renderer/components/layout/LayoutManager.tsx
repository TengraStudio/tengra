import { useLanguage } from '@renderer/i18n';
import { useBreakpoint } from '@renderer/lib/responsive';
import React, { useRef } from 'react';

import { useTheme } from '@/context/ThemeContext';
import { cn } from '@/lib/utils';

import './layout-manager.css';

interface LayoutManagerProps {
    sidebarContent: React.ReactNode;
    mainContent: React.ReactNode;
    panelContent?: React.ReactNode;
    showPanel?: boolean;
    rightSidebarContent?: React.ReactNode;
    showRightSidebar?: boolean;
    rightSidebarWidth?: number;
    isSidebarCollapsed?: boolean;
    setIsSidebarCollapsed?: (collapsed: boolean) => void;
}

export const LayoutManager: React.FC<LayoutManagerProps> = ({
    sidebarContent,
    mainContent,
    panelContent,
    showPanel = false,
    rightSidebarContent,
    showRightSidebar = false,
    rightSidebarWidth = 400,
    isSidebarCollapsed = false,
    setIsSidebarCollapsed: _setIsSidebarCollapsed,
}) => {
    const { theme } = useTheme();
    const { isRTL } = useLanguage();
    const breakpoint = useBreakpoint();
    const containerRef = useRef<HTMLDivElement>(null);
    const effectiveSidebarWidth = isSidebarCollapsed
        ? breakpoint === 'mobile'
            ? 0
            : 60
        : breakpoint === 'mobile'
            ? 220
            : 280;

    return (
        <div
            ref={containerRef}
            dir={isRTL ? 'rtl' : 'ltr'}
            className={cn(
                'tengra-layout-manager',
                theme
            )}
        >
            {/* Sidebar */}
            <div
                className="tengra-layout-manager__sidebar"
                style={{ width: effectiveSidebarWidth }}
            >
                {sidebarContent}
            </div>

            {/* Main Content */}
            <div className="tengra-layout-manager__main">
                {showPanel && panelContent ? (
                    <>
                        <div className="tengra-layout-manager__main-content">{mainContent}</div>
                        <div className="tengra-layout-manager__panel-divider" />
                        <div className="tengra-layout-manager__panel">
                            {panelContent}
                        </div>
                    </>
                ) : (
                    <div className="tengra-layout-manager__main-full">{mainContent}</div>
                )}
            </div>

            {/* Right Sidebar */}
            {showRightSidebar && rightSidebarContent && (
                <div
                    className="tengra-layout-manager__right-sidebar animate-in slide-in-from-right duration-300"
                    style={{ width: rightSidebarWidth }}
                >
                    {rightSidebarContent}
                </div>
            )}
        </div>
    );
};

LayoutManager.displayName = 'LayoutManager';
