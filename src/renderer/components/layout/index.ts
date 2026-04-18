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
    usePanelLayout} from '@renderer/components/layout/PanelLayout';

// Activity Bar
export {
    ActivityBar,
    ActivityBarLayout,
    ActivityBarProvider,
    type ActivityItem,
    useActivityBar} from '@renderer/components/layout/ActivityBar';

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
    WarningStatus} from '@renderer/components/layout/StatusBar';

// Existing components
export { AppHeader } from '@renderer/components/layout/AppHeader';
export { LayoutManager } from '@renderer/components/layout/LayoutManager';
export { Sidebar } from '@renderer/components/layout/Sidebar';
export * from '@renderer/components/layout/SimpleResizable';
