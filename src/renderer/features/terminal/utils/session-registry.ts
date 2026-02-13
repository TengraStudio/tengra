const initializedTerminalSessions = new Set<string>();
const initializingTerminalSessions = new Set<string>();

export function isTerminalSessionInitialized(id: string): boolean {
    return initializedTerminalSessions.has(id);
}

export function isTerminalSessionInitializing(id: string): boolean {
    return initializingTerminalSessions.has(id);
}

export function markTerminalSessionInitialized(id: string): void {
    initializedTerminalSessions.add(id);
    initializingTerminalSessions.delete(id);
}

export function markTerminalSessionInitializing(id: string): void {
    initializingTerminalSessions.add(id);
}

export function clearTerminalSessionFlags(id: string): void {
    initializedTerminalSessions.delete(id);
    initializingTerminalSessions.delete(id);
}

