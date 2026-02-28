/**
 * Database Health Store Tests (B-0495, B-0497)
 *
 * Tests for the component health store used by DatabaseService UI.
 * Covers loading/empty/failure state transitions, success/failure recording,
 * retry/fallback tracking, and performance budget exceeded counting.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import {
    __resetDatabaseHealthForTests,
    getDatabaseHealthSnapshot,
    recordDatabaseFailure,
    recordDatabaseFallback,
    recordDatabaseRetry,
    recordDatabaseSuccess,
    setDatabaseUiState,
    subscribeDatabaseHealth
} from '@renderer/store/database-health.store';

describe('Database Health Store', () => {
    beforeEach(() => {
        __resetDatabaseHealthForTests();
    });

    // B-0497: Loading state
    describe('UI state transitions', () => {
        it('starts in ready state', () => {
            const snap = getDatabaseHealthSnapshot();
            expect(snap.uiState).toBe('ready');
            expect(snap.name).toBe('database');
        });

        it('transitions to loading', () => {
            setDatabaseUiState('loading');
            expect(getDatabaseHealthSnapshot().uiState).toBe('loading');
        });

        it('transitions to empty', () => {
            setDatabaseUiState('empty');
            expect(getDatabaseHealthSnapshot().uiState).toBe('empty');
        });

        it('transitions to failure', () => {
            setDatabaseUiState('failure');
            expect(getDatabaseHealthSnapshot().uiState).toBe('failure');
        });

        it('can transition from failure back to ready', () => {
            setDatabaseUiState('failure');
            setDatabaseUiState('ready');
            expect(getDatabaseHealthSnapshot().uiState).toBe('ready');
        });
    });

    // B-0497: Success/failure recording
    describe('success tracking', () => {
        it('increments successCount and sets uiState to ready', () => {
            setDatabaseUiState('loading');
            recordDatabaseSuccess(50);
            const snap = getDatabaseHealthSnapshot();
            expect(snap.successCount).toBe(1);
            expect(snap.uiState).toBe('ready');
            expect(snap.lastDurationMs).toBe(50);
        });

        it('computes running average duration', () => {
            recordDatabaseSuccess(100);
            recordDatabaseSuccess(200);
            const snap = getDatabaseHealthSnapshot();
            expect(snap.avgDurationMs).toBe(150);
        });

        it('clears lastErrorCode on success', () => {
            recordDatabaseFailure('DB_CONNECTION_FAILED');
            recordDatabaseSuccess(10);
            expect(getDatabaseHealthSnapshot().lastErrorCode).toBeNull();
        });
    });

    describe('failure tracking', () => {
        it('increments failureCount and sets error code', () => {
            recordDatabaseFailure('DB_INVALID_QUERY', 5);
            const snap = getDatabaseHealthSnapshot();
            expect(snap.failureCount).toBe(1);
            expect(snap.lastErrorCode).toBe('DB_INVALID_QUERY');
            expect(snap.uiState).toBe('failure');
        });

        it('defaults errorCode to UNKNOWN_COMPONENT_ERROR for empty string', () => {
            recordDatabaseFailure('');
            expect(getDatabaseHealthSnapshot().lastErrorCode).toBe('UNKNOWN_COMPONENT_ERROR');
        });
    });

    // B-0497: Retry/fallback tracking
    describe('retry and fallback', () => {
        it('increments retryCount', () => {
            recordDatabaseRetry();
            recordDatabaseRetry();
            expect(getDatabaseHealthSnapshot().retryCount).toBe(2);
        });

        it('increments fallbackCount', () => {
            recordDatabaseFallback();
            expect(getDatabaseHealthSnapshot().fallbackCount).toBe(1);
        });
    });

    // B-0496: Budget exceeded tracking
    describe('performance budget tracking', () => {
        it('budget is set to 250ms for database', () => {
            expect(getDatabaseHealthSnapshot().budgetMs).toBe(250);
        });

        it('counts budget exceeded when duration > budget', () => {
            recordDatabaseSuccess(300); // > 250ms budget
            expect(getDatabaseHealthSnapshot().budgetExceededCount).toBe(1);
        });

        it('does not count budget exceeded when duration <= budget', () => {
            recordDatabaseSuccess(100);
            expect(getDatabaseHealthSnapshot().budgetExceededCount).toBe(0);
        });

        it('accumulates budget exceeded across calls', () => {
            recordDatabaseSuccess(300);
            recordDatabaseSuccess(100);
            recordDatabaseSuccess(500);
            expect(getDatabaseHealthSnapshot().budgetExceededCount).toBe(2);
        });
    });

    // B-0497: Subscribe/notify
    describe('subscription notifications', () => {
        it('notifies listeners on state change', () => {
            let notified = 0;
            const unsubscribe = subscribeDatabaseHealth(() => { notified += 1; });
            setDatabaseUiState('loading');
            expect(notified).toBe(1);
            unsubscribe();
        });

        it('stops notifying after unsubscribe', () => {
            let notified = 0;
            const unsubscribe = subscribeDatabaseHealth(() => { notified += 1; });
            setDatabaseUiState('loading');
            unsubscribe();
            setDatabaseUiState('ready');
            expect(notified).toBe(1);
        });
    });

    // B-0497: Reset
    describe('reset', () => {
        it('resets all counters to initial state', () => {
            recordDatabaseSuccess(100);
            recordDatabaseFailure('ERR');
            recordDatabaseRetry();
            recordDatabaseFallback();
            __resetDatabaseHealthForTests();

            const snap = getDatabaseHealthSnapshot();
            expect(snap.successCount).toBe(0);
            expect(snap.failureCount).toBe(0);
            expect(snap.retryCount).toBe(0);
            expect(snap.fallbackCount).toBe(0);
            expect(snap.lastErrorCode).toBeNull();
            expect(snap.uiState).toBe('ready');
        });
    });

    // B-0497: Timestamp tracking
    describe('timestamp tracking', () => {
        it('updates lastUpdatedAt on every mutation', () => {
            const before = Date.now();
            recordDatabaseSuccess(10);
            const snap = getDatabaseHealthSnapshot();
            expect(snap.lastUpdatedAt).toBeGreaterThanOrEqual(before);
        });
    });
});
