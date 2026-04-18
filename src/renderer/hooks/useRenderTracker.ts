/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { useEffect, useRef } from 'react';

import { appLogger } from '@/utils/renderer-logger';

const IS_DEV = process.env.NODE_ENV === 'development';

/**
 * Lightweight hook that tracks and logs component render counts in development mode only.
 * No-op in production builds — zero overhead.
 * @param componentName - Identifier for the component being tracked
 */
export function useRenderTracker(componentName: string): void {
    const renderCount = useRef(0);

    useEffect(() => {
        renderCount.current += 1;
        if (!IS_DEV) {
            return;
        }
        appLogger.debug('RenderTracker', `${componentName} rendered #${renderCount.current}`);
    });
}
