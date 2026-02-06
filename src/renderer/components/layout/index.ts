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
