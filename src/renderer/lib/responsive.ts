import { useEffect, useMemo, useState } from 'react';

export const BREAKPOINTS = {
    mobile: 640,
    tablet: 1024,
    desktop: 1440,
} as const;

export type BreakpointId = 'mobile' | 'tablet' | 'desktop' | 'wide';

export function resolveBreakpoint(width: number): BreakpointId {
    if (width < BREAKPOINTS.mobile) {
        return 'mobile';
    }
    if (width < BREAKPOINTS.tablet) {
        return 'tablet';
    }
    if (width < BREAKPOINTS.desktop) {
        return 'desktop';
    }
    return 'wide';
}

export function useBreakpoint(): BreakpointId {
    const [width, setWidth] = useState(
        typeof window === 'undefined' ? BREAKPOINTS.desktop : window.innerWidth
    );

    useEffect(() => {
        const onResize = () => {
            setWidth(window.innerWidth);
        };
        window.addEventListener('resize', onResize);
        return () => {
            window.removeEventListener('resize', onResize);
        };
    }, []);

    return useMemo(() => resolveBreakpoint(width), [width]);
}

export function useBreakpointValue<T>(values: {
    mobile: T;
    tablet: T;
    desktop: T;
    wide?: T;
}): T {
    const breakpoint = useBreakpoint();
    if (breakpoint === 'mobile') {
        return values.mobile;
    }
    if (breakpoint === 'tablet') {
        return values.tablet;
    }
    if (breakpoint === 'desktop') {
        return values.desktop;
    }
    return values.wide ?? values.desktop;
}
