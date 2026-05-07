/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * Layout Components Export
 * VSCode-like layout system with panels, activity bar, and status bar.
 */

// Panel Layout System
export {
    type Panel,
    type PanelGroup,
    PanelLayout,
    PanelLayoutProvider,
    type PanelPosition,
    type PanelSize,
    usePanelLayout} from '@/components/layout/PanelLayout';

// Activity Bar
export {
    ActivityBar,
    ActivityBarLayout,
    ActivityBarProvider,
    type ActivityItem,
    useActivityBar} from '@/components/layout/ActivityBar';

// Status Bar
export {
    ConnectionStatus,
    ErrorStatus,
    GitBranchStatus,
    LoadingStatus,
    ModelStatus,
    NotificationBell,
    StatusBar,
    type StatusBarItem,
    StatusBarProvider,
    useStatusBar,
    WarningStatus} from '@/components/layout/StatusBar';

// Existing components
export { AppHeader } from '@/components/layout/AppHeader';
export { LayoutManager } from '@/components/layout/LayoutManager';
export { Sidebar } from '@/components/layout/Sidebar';
export * from '@/components/layout/SimpleResizable';

