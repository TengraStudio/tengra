// Re-export all stores for convenient imports
export {
    getUiLayoutSnapshot,
    subscribeUiLayout,
    setActivityBarState,
    setAppShellState,
    setProjectShellState,
    importUiLayoutState,
    exportUiLayoutState,
    useUiLayoutStore
} from './ui-layout.store';

export {
    getThemeSnapshot,
    subscribeTheme,
    setTheme,
    toggleTheme,
    useThemeStore
} from './theme.store';

export {
    getSidebarSnapshot,
    subscribeSidebar,
    setSidebarCollapsed,
    toggleSidebarCollapsed,
    setSidebarWidth,
    setSidebarActiveSection,
    useSidebarStore
} from './sidebar.store';

export {
    loadSettings,
    updateSettings as updateSettingsInStore,
    useSettingsStore
} from './settings.store';

export {
    getNotificationCenterSnapshot,
    subscribeNotificationCenter,
    pushNotification,
    dismissNotification,
    markNotificationRead,
    markAllNotificationsRead,
    scheduleNotification,
    setNotificationPreferences,
    clearNotificationHistory,
    useNotificationCenterStore
} from './notification-center.store';

export {
    beginLoadingOperation,
    updateLoadingOperationProgress,
    completeLoadingOperation,
    getLoadingAnalyticsSnapshot,
    useLoadingAnalyticsStore
} from './loading-analytics.store';

export {
    trackResponsiveBreakpoint,
    getResponsiveAnalyticsSnapshot,
    useResponsiveAnalyticsStore
} from './responsive-analytics.store';

export {
    setAnimationDebugEnabled,
    trackAnimationEvent,
    getAnimationAnalyticsSnapshot,
    useAnimationAnalyticsStore
} from './animation-analytics.store';

export {
    trackTooltipShown,
    trackTooltipHidden,
    getTooltipAnalyticsSnapshot,
    useTooltipAnalyticsStore
} from './tooltip-analytics.store';
