/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 */

import { ipcRenderer } from 'electron';
import type { RuntimeValue } from '@shared/types/common';

/**
 * Creates a type-safe (ish) proxy for a Main process service.
 * Dispatches calls to `${domain}:${method}`.
 */
export function createServiceProxy<T extends object>(domain: string): T {
    return new Proxy({} as T, {
        get: (_target, method: string) => {
            // Special case for EventEmitter or other common fields if needed
            if (method === 'then' || method === 'constructor' || method === 'prototype') {
                return undefined;
            }

            return (...args: RuntimeValue[]) => {
                return ipcRenderer.invoke(`${domain}:${method}`, ...args);
            };
        }
    });
}
