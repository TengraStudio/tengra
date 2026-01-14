/**
 * Responsive design utilities
 * Provides hooks and utilities for responsive design across screen sizes
 */

import { useEffect,useState } from 'react'

export type Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'

export const breakpoints: Record<Breakpoint, number> = {
    xs: 0,
    sm: 640,
    md: 768,
    lg: 1024,
    xl: 1280,
    '2xl': 1536
}

/**
 * Hook to get current breakpoint
 */
export function useBreakpoint(): Breakpoint {
    const [breakpoint, setBreakpoint] = useState<Breakpoint>('md')

    useEffect(() => {
        const updateBreakpoint = () => {
            const width = window.innerWidth
            if (width >= breakpoints['2xl']) {setBreakpoint('2xl')}
            else if (width >= breakpoints.xl) {setBreakpoint('xl')}
            else if (width >= breakpoints.lg) {setBreakpoint('lg')}
            else if (width >= breakpoints.md) {setBreakpoint('md')}
            else if (width >= breakpoints.sm) {setBreakpoint('sm')}
            else {setBreakpoint('xs')}
        }

        updateBreakpoint()
        window.addEventListener('resize', updateBreakpoint)
        return () => window.removeEventListener('resize', updateBreakpoint)
    }, [])

    return breakpoint
}

/**
 * Hook to check if current breakpoint matches
 */
export function useMediaQuery(query: string): boolean {
    const [matches, setMatches] = useState(false)

    useEffect(() => {
        const media = window.matchMedia(query)
        if (media.matches !== matches) {
            setMatches(media.matches)
        }

        const listener = () => setMatches(media.matches)
        media.addEventListener('change', listener)
        return () => media.removeEventListener('change', listener)
    }, [matches, query])

    return matches
}

/**
 * Utility to get responsive class names
 */
export function getResponsiveClasses(base: string, variants: Partial<Record<Breakpoint, string>>): string {
    const classes = [base]
    
    Object.entries(variants).forEach(([bp, variant]) => {
        if (variant) {
            classes.push(`${bp}:${variant}`)
        }
    })
    
    return classes.join(' ')
}
