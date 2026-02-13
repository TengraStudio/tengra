import { useEffect, useState } from 'react';

export type AnimationPresetId = 'micro' | 'default' | 'emphasized' | 'page' | 'tooltip';

type AnimationPreset = {
    duration: number;
    ease: number[];
};

export const ANIMATION_PRESETS: Record<AnimationPresetId, AnimationPreset> = {
    micro: { duration: 0.12, ease: [0.2, 0, 0, 1] },
    default: { duration: 0.2, ease: [0.22, 1, 0.36, 1] },
    emphasized: { duration: 0.32, ease: [0.16, 1, 0.3, 1] },
    page: { duration: 0.24, ease: [0.22, 1, 0.36, 1] },
    tooltip: { duration: 0.16, ease: [0.2, 0.9, 0.3, 1] },
};

export function resolveAnimationPreset(
    preset: AnimationPresetId,
    prefersReducedMotion: boolean
): AnimationPreset {
    if (prefersReducedMotion) {
        return { duration: 0, ease: [0, 0, 1, 1] };
    }
    return ANIMATION_PRESETS[preset];
}

export function getAnimationDurationMs(
    preset: AnimationPresetId,
    prefersReducedMotion: boolean
): number {
    return Math.round(resolveAnimationPreset(preset, prefersReducedMotion).duration * 1000);
}

export function usePrefersReducedMotion(): boolean {
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        const update = () => {
            const forced = window.localStorage.getItem('tandem.motion.force-reduced') === 'true';
            setPrefersReducedMotion(mediaQuery.matches || forced);
        };
        update();
        mediaQuery.addEventListener('change', update);
        return () => {
            mediaQuery.removeEventListener('change', update);
        };
    }, []);

    return prefersReducedMotion;
}
