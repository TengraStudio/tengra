/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { createComponentHealthStore } from '@/ui/store/component-health.store';

/**
 * Monitoring Health Store (BACKLOG-0457)
 *
 * Provides health tracking for the MonitoringService including:
 * - Metric collection success/failure rates
 * - Collection latency tracking against budgets
 * - Loading, empty, and failure-state UX support
 *
 * Performance budget: 6000ms (matches GET_SYSTEM_MONITOR_MS)
 */

const monitoringHealthStore = createComponentHealthStore('monitoring', 6000);

export const subscribeMonitoringHealth = monitoringHealthStore.subscribe;
export const getMonitoringHealthSnapshot = monitoringHealthStore.getSnapshot;
export const useMonitoringHealth = monitoringHealthStore.useSnapshot;
export const setMonitoringUiState = monitoringHealthStore.setUiState;
export const recordMonitoringSuccess = monitoringHealthStore.recordSuccess;
export const recordMonitoringFailure = monitoringHealthStore.recordFailure;
export const recordMonitoringRetry = monitoringHealthStore.recordRetry;
export const recordMonitoringFallback = monitoringHealthStore.recordFallback;
export const __resetMonitoringHealthForTests = monitoringHealthStore.resetForTests;
