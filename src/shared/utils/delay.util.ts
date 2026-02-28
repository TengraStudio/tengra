/**
 * Returns a promise that resolves after the specified delay in milliseconds.
 * @param ms - The delay in milliseconds
 */
export function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
