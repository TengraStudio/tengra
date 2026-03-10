import { useCallback, useEffect, useRef } from 'react';

import { useLowPowerMode } from '@/context/low-power.context';

interface VisibilityAwareIntervalOptions {
    /** When true, fully pauses the interval when document is hidden. Defaults to true. */
    pauseWhenHidden?: boolean
    /** Multiplier applied to intervalMs when document is hidden. Only used when pauseWhenHidden is false. Defaults to 3. */
    slowFactor?: number
}

/**
 * Runs a callback on an interval that responds to document visibility changes.
 * When the document is hidden, the interval is either paused or slowed down.
 * When the document becomes visible again, the callback fires immediately and
 * the original interval is restored.
 *
 * @param callback - Function to invoke on each tick
 * @param intervalMs - Base interval in milliseconds
 * @param options - Visibility behaviour configuration
 */
export function useVisibilityAwareInterval(
    callback: () => void,
    intervalMs: number,
    options?: VisibilityAwareIntervalOptions
): void {
    const { pauseWhenHidden = true, slowFactor = 3 } = options ?? {};
    const { isLowPowerMode } = useLowPowerMode();

    const callbackRef = useRef(callback);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        callbackRef.current = callback;
    }, [callback]);

    const clearTimer = useCallback(() => {
        if (timerRef.current !== null) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    const startTimer = useCallback((ms: number) => {
        clearTimer();
        timerRef.current = setInterval(() => {
            callbackRef.current();
        }, ms);
    }, [clearTimer]);

    useEffect(() => {
        const isBackgrounded = document.hidden || isLowPowerMode;
        
        if (isBackgrounded) {
            clearTimer();
            if (!pauseWhenHidden) {
                startTimer(intervalMs * slowFactor);
            }
        } else {
            callbackRef.current();
            startTimer(intervalMs);
        }

        const handleVisibilityChange = () => {
            const backgrounded = document.hidden || isLowPowerMode;
            if (backgrounded) {
                clearTimer();
                if (!pauseWhenHidden) {
                    startTimer(intervalMs * slowFactor);
                }
            } else {
                callbackRef.current();
                startTimer(intervalMs);
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            clearTimer();
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [intervalMs, pauseWhenHidden, slowFactor, startTimer, clearTimer, isLowPowerMode]);
}

