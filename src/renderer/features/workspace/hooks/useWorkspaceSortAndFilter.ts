/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { useEffect, useMemo, useState } from 'react';

import { Workspace } from '@/types';

import { loadWorkspaceListPreferences, saveWorkspaceListPreferences } from './useWorkspaceListStateMachine';

const LIST_SETTINGS_STORAGE_KEY = 'workspaces.listView.settings.v1';

export function useWorkspaceSortAndFilter(workspaces: Workspace[]) {
    const initialPreferences = useMemo(
        () =>
            loadWorkspaceListPreferences(LIST_SETTINGS_STORAGE_KEY, {
            viewMode: 'grid',
            sortBy: 'updatedAt',
            sortDirection: 'desc',
            listPreset: 'recent',
            }),
        []
    );

    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>(initialPreferences.viewMode);
    const [sortBy, setSortBy] = useState<'title' | 'updatedAt' | 'createdAt'>(initialPreferences.sortBy);
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(initialPreferences.sortDirection);
    const [listPreset, setListPreset] = useState<'recent' | 'oldest' | 'name-az' | 'name-za'>(initialPreferences.listPreset);

    useEffect(() => {
        saveWorkspaceListPreferences(LIST_SETTINGS_STORAGE_KEY, {
            viewMode,
            sortBy,
            sortDirection,
            listPreset,
        });
    }, [viewMode, sortBy, sortDirection, listPreset]);

    const normalizedSearchQuery = useMemo(() => searchQuery.trim().toLowerCase(), [searchQuery]);

    const workspaceSearchIndex = useMemo(() => {
        const index = new Map<string, string>();
        for (const workspace of workspaces) {
            index.set(
                workspace.id,
                `${workspace.title} ${workspace.description}`.toLowerCase()
            );
        }
        return index;
    }, [workspaces]);

    const sortedWorkspacesByActiveSort = useMemo(() => {
        const direction = sortDirection === 'asc' ? 1 : -1;
        return [...workspaces].sort((a, b) => {
            if (sortBy === 'title') {
                return a.title.localeCompare(b.title) * direction;
            }
            return (a[sortBy] - b[sortBy]) * direction;
        });
    }, [workspaces, sortBy, sortDirection]);

    const filteredWorkspaces = useMemo(
        () =>
            normalizedSearchQuery === ''
                ? sortedWorkspacesByActiveSort
                : sortedWorkspacesByActiveSort.filter(workspace =>
                    (workspaceSearchIndex.get(workspace.id) ?? '').includes(normalizedSearchQuery)
                ),
        [sortedWorkspacesByActiveSort, normalizedSearchQuery, workspaceSearchIndex]
    );

    const toggleSort = (nextSortBy: 'title' | 'updatedAt' | 'createdAt') => {
        if (sortBy === nextSortBy) {
            setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
            return;
        }
        setSortBy(nextSortBy);
        setSortDirection(nextSortBy === 'title' ? 'asc' : 'desc');
    };

    const applyListPreset = (preset: 'recent' | 'oldest' | 'name-az' | 'name-za') => {
        setListPreset(preset);
        switch (preset) {
            case 'oldest':
                setSortBy('updatedAt');
                setSortDirection('asc');
                break;
            case 'name-az':
                setSortBy('title');
                setSortDirection('asc');
                break;
            case 'name-za':
                setSortBy('title');
                setSortDirection('desc');
                break;
            default:
                setSortBy('updatedAt');
                setSortDirection('desc');
                break;
        }
    };

    return {
        searchQuery,
        setSearchQuery,
        viewMode,
        setViewMode,
        sortBy,
        sortDirection,
        listPreset,
        filteredWorkspaces,
        toggleSort,
        applyListPreset
    };
}
