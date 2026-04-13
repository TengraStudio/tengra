export async function withOperationGuard<T>(
    _scope: string,
    fn: () => Promise<T>
): Promise<T> {
    return fn();
}
