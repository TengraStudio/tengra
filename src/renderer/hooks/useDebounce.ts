import { useState, useEffect } from 'react'
import { JsonValue } from '../../shared/types/common'

/**
 * Debounces a value by the specified delay.
 * @param value The value to debounce
 * @param delay Delay in milliseconds (default: 300ms)
 * @returns The debounced value
 */
export function useDebouncedValue<T>(value: T, delay: number = 300): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value)

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedValue(value)
        }, delay)

        return () => {
            clearTimeout(timer)
        }
    }, [value, delay])

    return debouncedValue
}

/**
 * Creates a debounced callback function.
 * @param callback The function to debounce
 * @param delay Delay in milliseconds (default: 300ms)
 * @returns The debounced function
 */
export function useDebouncedCallback<T extends (...args: JsonValue[]) => JsonValue | void>(
    callback: T,
    delay: number = 300
): (...args: Parameters<T>) => void {
    const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null)

    const debouncedCallback = (...args: Parameters<T>) => {
        if (timeoutId) {
            clearTimeout(timeoutId)
        }
        const id = setTimeout(() => {
            callback(...args)
        }, delay)
        setTimeoutId(id)
    }

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (timeoutId) {
                clearTimeout(timeoutId)
            }
        }
    }, [timeoutId])

    return debouncedCallback
}
