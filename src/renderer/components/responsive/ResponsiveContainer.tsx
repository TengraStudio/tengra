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
 * Responsive Container Component
 * Provides adaptive layouts for different screen sizes
 */

import { ReactNode } from 'react';

import { cn } from '@/lib/utils';
import { useBreakpoint } from '@/utils/responsive';

interface ResponsiveContainerProps {
    children: ReactNode
    className?: string
    mobileClassName?: string
    tabletClassName?: string
    desktopClassName?: string
    hideOnMobile?: boolean
    hideOnTablet?: boolean
    hideOnDesktop?: boolean
}

type DeviceType = 'mobile' | 'tablet' | 'desktop';
type BreakpointType = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

const DEVICE_MAP: Record<BreakpointType, DeviceType> = {
    'xs': 'mobile',
    'sm': 'mobile',
    'md': 'tablet',
    'lg': 'desktop',
    'xl': 'desktop',
    '2xl': 'desktop'
};

function getDeviceType(breakpoint: BreakpointType): DeviceType {
    return DEVICE_MAP[breakpoint];
}

/**
 * Container that adapts to screen size
 */
export function ResponsiveContainer({
    children,
    className,
    mobileClassName,
    tabletClassName,
    desktopClassName,
    hideOnMobile,
    hideOnTablet,
    hideOnDesktop
}: ResponsiveContainerProps) {
    const breakpoint = useBreakpoint() as BreakpointType;
    const device = getDeviceType(breakpoint);

    const hideConfig: Record<DeviceType, boolean | undefined> = {
        mobile: hideOnMobile,
        tablet: hideOnTablet,
        desktop: hideOnDesktop
    };

    if (hideConfig[device]) { return null; }

    const classConfig: Record<DeviceType, string | undefined> = {
        mobile: mobileClassName,
        tablet: tabletClassName,
        desktop: desktopClassName
    };

    return (
        <div className={cn(className, classConfig[device])}>
            {children}
        </div>
    );
}

interface ResponsiveGridProps {
    children: ReactNode
    cols?: { mobile?: number; tablet?: number; desktop?: number }
    gap?: { mobile?: string; tablet?: string; desktop?: string }
    className?: string
}

const GRID_COLS_CLASS_MAP: Record<number, string> = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
    5: 'grid-cols-5',
    6: 'grid-cols-6',
    7: 'grid-cols-7',
    8: 'grid-cols-8',
    9: 'grid-cols-9',
    10: 'grid-cols-10',
    11: 'grid-cols-11',
    12: 'grid-cols-12',
};

function resolveGridColsClass(cols: number): string {
    return GRID_COLS_CLASS_MAP[cols] ?? GRID_COLS_CLASS_MAP[1];
}

/**
 * Responsive grid that adapts column count
 */
export function ResponsiveGrid({
    children,
    cols = { mobile: 1, tablet: 2, desktop: 3 },
    gap = { mobile: 'gap-2', tablet: 'gap-4', desktop: 'gap-6' },
    className
}: ResponsiveGridProps) {
    const breakpoint = useBreakpoint() as BreakpointType;
    const device = getDeviceType(breakpoint);

    const colsConfig: Record<DeviceType, number> = {
        mobile: cols.mobile ?? 1,
        tablet: cols.tablet ?? 2,
        desktop: cols.desktop ?? 3
    };

    const gapConfig: Record<DeviceType, string> = {
        mobile: gap.mobile ?? 'gap-2',
        tablet: gap.tablet ?? 'gap-4',
        desktop: gap.desktop ?? 'gap-6'
    };

    return (
        <div className={cn('grid', resolveGridColsClass(colsConfig[device]), gapConfig[device], className)}>
            {children}
        </div>
    );
}

interface TouchTargetProps {
    children: ReactNode
    minSize?: number
    className?: string
}

/**
 * Ensures touch targets meet accessibility standards (min 44x44px)
 */
export function TouchTarget({
    children,
    minSize = 44,
    className
}: TouchTargetProps) {
    return (
        <div
            className={cn('touch-manipulation', className)}
            style={{ minWidth: `${minSize}px`, minHeight: `${minSize}px` }}
        >
            {children}
        </div>
    );
}

