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
 * Responsive design utilities
 * Provides hooks and utilities for responsive design across screen sizes
 */

import { useEffect, useState } from 'react';

export type Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'

export const breakpoints: Record<Breakpoint, number> = {
    xs: 0,
    sm: 640,
    md: 768,
    lg: 1024,
    xl: 1280,
    '2xl': 1536
};

/**
 * Hook to get current breakpoint
 */
export function useBreakpoint(): Breakpoint {
    const [breakpoint, setBreakpoint] = useState<Breakpoint>('md');

    useEffect(() => {
        const updateBreakpoint = () => {
            const width = window.innerWidth;
            if (width >= breakpoints['2xl']) { setBreakpoint('2xl'); }
            else if (width >= breakpoints.xl) { setBreakpoint('xl'); }
            else if (width >= breakpoints.lg) { setBreakpoint('lg'); }
            else if (width >= breakpoints.md) { setBreakpoint('md'); }
            else if (width >= breakpoints.sm) { setBreakpoint('sm'); }
            else { setBreakpoint('xs'); }
        };

        updateBreakpoint();
        window.addEventListener('resize', updateBreakpoint);
        return () => window.removeEventListener('resize', updateBreakpoint);
    }, []);

    return breakpoint;
}

