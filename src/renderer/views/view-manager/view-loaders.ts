/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { lazy } from 'react';

import type { AppView } from '@/hooks/useAppState';

const loadDockerDashboardView = () =>
    import('@/features/mcp/DockerDashboard').then(module => ({ default: module.DockerDashboard }));
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
const loadImageStudioView = () =>
    import('@/features/images/ImageStudioView').then(module => ({ default: module.ImageStudioView }));

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
    docker: async () => {
        await loadDockerDashboardView();
    },
    models: async () => {
        await loadModelsPageView();
    },
    marketplace: async () => {
        await loadMarketplaceView();
    },
    images: async () => {
        await loadImageStudioView();
    },
};

const DEFAULT_PRELOAD_VIEWS: readonly AppView[] = ['chat'];

export const DockerDashboardView = lazy(loadDockerDashboardView);
export const ModelsPageView = lazy(loadModelsPageView);
export const ChatViewWrapperView = lazy(loadChatViewWrapperView);
export const WorkspaceRouteView = lazy(loadWorkspaceView);
export const SettingsRouteView = lazy(loadSettingsView);
export const MarketplaceView = lazy(loadMarketplaceView);
export const ImageStudioView = lazy(loadImageStudioView);

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
