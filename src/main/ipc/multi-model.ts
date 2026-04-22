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
import type { MultiModelComparisonService } from '@main/services/llm/multi-model-comparison.service';

/**
 * Registers IPC handlers for multi-model comparison operations
 */
export function registerMultiModelIpc(_comparisonService: MultiModelComparisonService): void {
    appLogger.info('MultiModelIPC', 'Registering multi-model IPC handlers');
}
