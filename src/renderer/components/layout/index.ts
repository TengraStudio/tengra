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
} from './PanelLayout'

// Activity Bar
export {
    ActivityBar,
    ActivityBarProvider,
    ActivityBarLayout,
    useActivityBar,
    DEFAULT_ACTIVITIES,
    type ActivityItem
} from './ActivityBar'

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
} from './StatusBar'

// Existing components
export { LayoutManager } from './LayoutManager'
export { Sidebar } from './Sidebar'
export { AppHeader } from './AppHeader'
export * from './SimpleResizable'
