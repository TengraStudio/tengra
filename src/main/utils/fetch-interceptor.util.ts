/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { appLogger } from '@main/logging/logger';

/**
 * Enhanced fetch wrapper with logging capabilities.
 */
export async function fetchWithLogging(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const startTime = Date.now();
    const method = init?.method ?? 'GET';
    const url = typeof input === 'string' ? input : (input instanceof URL ? input.toString() : input.url);

    // Log Request
    // Avoid logging full bodies for sensitive/large data, maybe just summary
    appLogger.debug('API', `--> ${method} ${url}`);

    try {
        const response = await fetch(input, init);

        const duration = Date.now() - startTime;
        appLogger.debug('API', `<-- ${response.status} ${response.statusText} ${url} (${duration}ms)`);

        return response;
    } catch (error) {
        const duration = Date.now() - startTime;
        appLogger.error('API', `<-- FAILED ${method} ${url} (${duration}ms): ${error}`);
        throw error;
    }
}
