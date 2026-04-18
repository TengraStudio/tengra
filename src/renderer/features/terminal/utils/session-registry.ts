/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

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

