import { lazy } from 'react';

import type { AppView } from '@/hooks/useAppState';

const loadDockerDashboardView = () =>
    import('@/features/mcp/DockerDashboard').then(module => ({ default: module.DockerDashboard }));
const loadMemoryInspectorView = () =>
    import('@/features/memory/components/MemoryInspector').then(module => ({ default: module.MemoryInspector }));
const loadModelsPageView = () =>
    import('@/features/models/pages/ModelsPage').then(module => ({ default: module.ModelsPage }));
const loadChatViewWrapperView = () =>
    import('./ChatViewWrapper').then(module => ({ default: module.ChatViewWrapper }));
const loadWorkspaceView = () =>
    import('@/features/workspace/WorkspacePage').then(module => ({ default: module.MemoizedWorkspacesPage }));
const loadSettingsView = () =>
    import('./SettingsView').then(module => ({ default: module.SettingsView }));
const loadMarketplaceView = () =>
    import('@/features/marketplace/MarketplaceView').then(module => ({ default: module.MarketplaceView }));

const preloadedViews = new Map<AppView, Promise<void>>();

const viewPreloaders: Partial<Record<AppView, () => Promise<void>>> = {
    chat: async () => {
        await Promise.all([
            import('./ChatViewWrapper'),
            import('@/features/chat/components/ChatView'),
        ]);
    },
    workspace: async () => {
        await Promise.all([
            import('@/features/workspace/WorkspacePage'),
            import('@/features/workspace/components/WorkspaceListPage'),
            import('@/features/workspace/components/WorkspaceDetails'),
            import('@/features/workspace/components/WorkspaceModals'),
        ]);
    },
    settings: async () => {
        await Promise.all([
            import('./SettingsView'),
            import('@/features/settings/SettingsPage'),
        ]);
    },
    mcp: async () => {
        await loadDockerDashboardView();
    },
    memory: async () => {
        await loadMemoryInspectorView();
    },
    docker: async () => {
        await loadDockerDashboardView();
    },
    models: async () => {
        await loadModelsPageView();
    },
    marketplace: async () => {
        await loadMarketplaceView();
    },
};

const DEFAULT_PRELOAD_VIEWS: readonly AppView[] = ['chat', 'workspace', 'settings'];

export const DockerDashboardView = lazy(loadDockerDashboardView);
export const MemoryInspectorView = lazy(loadMemoryInspectorView);
export const ModelsPageView = lazy(loadModelsPageView);
export const ChatViewWrapperView = lazy(loadChatViewWrapperView);
export const WorkspaceRouteView = lazy(loadWorkspaceView);
export const SettingsRouteView = lazy(loadSettingsView);
export const MarketplaceView = lazy(loadMarketplaceView);

export function getDefaultPreloadViews(currentView: AppView): AppView[] {
    return DEFAULT_PRELOAD_VIEWS.filter(view => view !== currentView);
}

export function preloadViewResources(view: AppView): Promise<void> {
    const preload = viewPreloaders[view];
    if (!preload) {
        return Promise.resolve();
    }

    const existing = preloadedViews.get(view);
    if (existing) {
        return existing;
    }

    const task = preload().catch(error => {
        preloadedViews.delete(view);
        throw error;
    });
    preloadedViews.set(view, task);
    return task;
}
