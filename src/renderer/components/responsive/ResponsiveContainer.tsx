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
    const breakpoint = useBreakpoint();
    const isMobile = breakpoint === 'xs' || breakpoint === 'sm';
    const isTablet = breakpoint === 'md';
    const isDesktop = breakpoint === 'lg' || breakpoint === 'xl' || breakpoint === '2xl';

    if (hideOnMobile && isMobile) {return null;}
    if (hideOnTablet && isTablet) {return null;}
    if (hideOnDesktop && isDesktop) {return null;}

    const responsiveClass = isMobile
        ? mobileClassName
        : isTablet
          ? tabletClassName
          : desktopClassName;

    return (
        <div className={cn(className, responsiveClass)}>
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

/**
 * Responsive grid that adapts column count
 */
export function ResponsiveGrid({
    children,
    cols = { mobile: 1, tablet: 2, desktop: 3 },
    gap = { mobile: 'gap-2', tablet: 'gap-4', desktop: 'gap-6' },
    className
}: ResponsiveGridProps) {
    const breakpoint = useBreakpoint();
    const isMobile = breakpoint === 'xs' || breakpoint === 'sm';
    const isTablet = breakpoint === 'md';

    const gridCols = isMobile
        ? `grid-cols-${cols.mobile || 1}`
        : isTablet
          ? `grid-cols-${cols.tablet || 2}`
          : `grid-cols-${cols.desktop || 3}`;

    const gridGap = isMobile
        ? gap.mobile || 'gap-2'
        : isTablet
          ? gap.tablet || 'gap-4'
          : gap.desktop || 'gap-6';

    return (
        <div className={cn('grid', gridCols, gridGap, className)}>
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
