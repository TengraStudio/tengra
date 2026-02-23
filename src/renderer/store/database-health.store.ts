import { createComponentHealthStore } from '@renderer/store/component-health.store';

/**
 * Database Health Store (BACKLOG-0495, BACKLOG-0497)
 *
 * Provides health tracking for the DatabaseService including:
 * - Query success/failure rates
 * - Query latency tracking against budgets
 * - Connection health monitoring
 * - Migration status tracking
 *
 * Performance budgets:
 * - Query operations: 250ms
 * - Connection test: 5000ms
 * - Migration: 30000ms
 */

const databaseHealthStore = createComponentHealthStore('database', 250);

export const subscribeDatabaseHealth = databaseHealthStore.subscribe;
export const getDatabaseHealthSnapshot = databaseHealthStore.getSnapshot;
export const useDatabaseHealth = databaseHealthStore.useSnapshot;
export const setDatabaseUiState = databaseHealthStore.setUiState;
export const recordDatabaseSuccess = databaseHealthStore.recordSuccess;
export const recordDatabaseFailure = databaseHealthStore.recordFailure;
export const recordDatabaseRetry = databaseHealthStore.recordRetry;
export const recordDatabaseFallback = databaseHealthStore.recordFallback;
export const __resetDatabaseHealthForTests = databaseHealthStore.resetForTests;
