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
 * @fileoverview Hook for managing expandable group state in sidebar
 * @description Provides toggle and expansion state management for collapsible
 * sidebar group sections with support for default-expanded groups.
 */
import { useCallback, useState } from 'react';
export const useSidebarGroups = () => {
    const [expandedProviders, setExpandedProviders] = useState<Set<string>>(new Set());

    const toggleProvider = useCallback((provider: string) => {
        setExpandedProviders(prev => {
            const next = new Set(prev);
            if (next.has(provider)) {
                next.delete(provider);
            } else {
                next.add(provider);
            }
            return next;
        });
    }, []);

    return {
        expandedProviders,
        toggleProvider
    };
};
