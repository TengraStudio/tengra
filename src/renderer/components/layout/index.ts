/**
 * Layout Components Export
 * VSCode-like layout system with panels, activity bar, and status bar.
 */

// Panel Layout System
export {
    PanelLayout,
    PanelLayoutProvider,
    usePanelLayout,
    type Panel,
    type PanelPosition,
    type PanelSize,
    type PanelGroup
} from '@renderer/components/layout/PanelLayout'

// Activity Bar
export {
    ActivityBar,
    ActivityBarProvider,
    ActivityBarLayout,
    useActivityBar,
    DEFAULT_ACTIVITIES,
    type ActivityItem
} from '@renderer/components/layout/ActivityBar'

// Status Bar
export {
    StatusBar,
    StatusBarProvider,
    useStatusBar,
    GitBranchStatus,
    ConnectionStatus,
    NotificationBell,
    LoadingStatus,
    ErrorStatus,
    WarningStatus,
    ModelStatus,
    type StatusBarItem
} from '@renderer/components/layout/StatusBar'

// Existing components
export { LayoutManager } from '@renderer/components/layout/LayoutManager'
export { Sidebar } from '@renderer/components/layout/Sidebar'
export { AppHeader } from '@renderer/components/layout/AppHeader'
export * from '@renderer/components/layout/SimpleResizable'
