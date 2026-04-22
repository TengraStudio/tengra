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
import type { ProxyService } from '@main/services/proxy/proxy.service';

/**
 * Registers IPC handlers for embedded proxy operations
 */
export function registerProxyEmbedIpc(_proxyService: ProxyService): void {
    appLogger.info('ProxyEmbedIPC', 'Registering proxy embed IPC handlers');
}
