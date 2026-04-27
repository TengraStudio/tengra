/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import React, { useRef } from 'react';

import { useTheme } from '@/context/ThemeContext';
import { useLanguage } from '@/i18n';
import { useBreakpoint } from '@/lib/responsive';
import { cn } from '@/lib/utils';


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
                'fixed inset-0 flex gap-2.5 overflow-hidden bg-background text-foreground',
                theme
            )}
        >
            {/* Sidebar */}
            <div
                className="relative h-full shrink-0 overflow-visible border-e border-border bg-background"
                style={{ width: effectiveSidebarWidth }}
            >
                {sidebarContent}
            </div>

            {/* Main Content */}
            <div className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden">
                {showPanel && panelContent ? (
                    <>
                        <div className="min-h-0 flex-1 overflow-hidden">{mainContent}</div>
                        <div className="h-px bg-border/50" />
                        <div className="h-1/4 min-h-24 overflow-hidden border-t border-border bg-card">
                            {panelContent}
                        </div>
                    </>
                ) : (
                    <div className="flex h-full w-full flex-col overflow-hidden">{mainContent}</div>
                )}
            </div>

            {/* Right Sidebar */}
            {showRightSidebar && rightSidebarContent && (
                <div
                    className="animate-in slide-in-from-right z-30 h-full shrink-0 border-l border-border bg-background duration-300"
                    style={{ width: rightSidebarWidth }}
                >
                    {rightSidebarContent}
                </div>
            )}
        </div>
    );
};

LayoutManager.displayName = 'LayoutManager';
