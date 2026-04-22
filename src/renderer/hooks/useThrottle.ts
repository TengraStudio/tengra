/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { useEffect, useRef, useState } from 'react';

/**
 * Custom hook for throttling a value during rapid updates (e.g., AI streaming)
 * 
 * @param value - The value to throttle
 * @param limit - Interval in milliseconds (default: 100ms)
 * @returns The throttled value
 */
export function useThrottle<T>(value: T, limit: number = 100): T {
    const [throttledValue, setThrottledValue] = useState<T>(value);
    const lastRan = useRef<number>(0);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        const handler = () => {
            if (Date.now() - lastRan.current >= limit) {
                setThrottledValue(value);
                lastRan.current = Date.now();
            } else {
                if (timeoutRef.current) clearTimeout(timeoutRef.current);
                timeoutRef.current = setTimeout(() => {
                    if (Date.now() - lastRan.current >= limit) {
                        setThrottledValue(value);
                        lastRan.current = Date.now();
                    }
                }, limit - (Date.now() - lastRan.current));
            }
        };

        handler();

        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [value, limit]);

    return throttledValue;
}
