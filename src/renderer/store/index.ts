/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

// Re-export all stores for convenient imports
export {
    getAnimationAnalyticsSnapshot,
    setAnimationDebugEnabled,
    trackAnimationEvent,
    useAnimationAnalyticsStore
} from './animation-analytics.store';
export {
    beginLoadingOperation,
    completeLoadingOperation,
    getLoadingAnalyticsSnapshot,
    updateLoadingOperationProgress,
    useLoadingAnalyticsStore
} from './loading-analytics.store';
export {
    clearNotificationHistory,
    dismissNotification,
    getNotificationCenterSnapshot,
    markAllNotificationsRead,
    markNotificationRead,
    pushNotification,
    scheduleNotification,
    setNotificationPreferences,
    subscribeNotificationCenter,
    useNotificationCenterStore
} from './notification-center.store';
export {
    getResponsiveAnalyticsSnapshot,
    trackResponsiveBreakpoint,
    useResponsiveAnalyticsStore
} from './responsive-analytics.store';
export {
    ensureSessionCapabilityCatalog,
    ensureSessionRecoverySnapshots,
    ensureSessionState,
    getSessionCapabilityCatalogSnapshot,
    getSessionRecoverySnapshotList,
    getSessionStateSnapshot,
    refreshSessionCapabilityCatalog,
    refreshSessionRecoverySnapshots,
    refreshSessionState,
    subscribeSessionRuntime
} from './session-runtime.store';
export {
    loadSettings,
    updateSettings as updateSettingsInStore,
    useSettingsStore
} from './settings.store';
export {
    getSidebarSnapshot,
    setSidebarActiveSection,
    setSidebarCollapsed,
    setSidebarWidth,
    subscribeSidebar,
    toggleSidebarCollapsed,
    useSidebarStore
} from './sidebar.store';
export type { ThemeLoadStatus } from './theme.store';
export {
    getThemeSnapshot,
    resetTheme,
    setTheme,
    subscribeTheme,
    toggleTheme,
    useThemeStore
} from './theme.store';
export {
    getTooltipAnalyticsSnapshot,
    trackTooltipHidden,
    trackTooltipShown,
    useTooltipAnalyticsStore
} from './tooltip-analytics.store';
export {
    exportUiLayoutState,
    getUiLayoutSnapshot,
    importUiLayoutState,
    setActivityBarState,
    setAppShellState,
    setWorkspaceShellState,
    subscribeUiLayout,
    useUiLayoutStore
} from './ui-layout.store';
