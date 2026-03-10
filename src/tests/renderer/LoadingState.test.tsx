import { LoadingState } from '@renderer/components/ui/LoadingState';
import {
    __resetLoadingAnalyticsForTests,
    getLoadingAnalyticsSnapshot,
} from '@renderer/store/loading-analytics.store';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('LoadingState', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-02-13T00:00:00.000Z'));
        __resetLoadingAnalyticsForTests();
    });

    afterEach(() => {
        __resetLoadingAnalyticsForTests();
        vi.useRealTimers();
    });

    it('renders progress, stage, estimate, and cancel action', () => {
        const onCancel = vi.fn();
        const startedAt = Date.now() - 2000;

        const { container } = render(
            <LoadingState
                message="Loading data"
                stage="Fetching records"
                progress={50}
                startedAt={startedAt}
                estimatedMs={6000}
                onCancel={onCancel}
                cancelLabel="Stop"
            />
        );

        expect(screen.getByText('Loading data')).toBeInTheDocument();
        expect(screen.getByText('Fetching records')).toBeInTheDocument();
        expect(screen.getByText('Stop')).toBeInTheDocument();
        expect(screen.getByText(/timeRemaining|remaining|Finalizing/)).toBeInTheDocument();
        expect(container.querySelector('[style*="width: 50%"]')).not.toBeNull();

        fireEvent.click(screen.getByText('Stop'));
        expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('registers and completes analytics operations by operationId lifecycle', () => {
        const { unmount } = render(
            <LoadingState
                message="Processing"
                operationId="loading-test-op"
                analyticsContext="tests"
                progress={10}
            />
        );

        expect(getLoadingAnalyticsSnapshot().active['loading-test-op']).toBeDefined();

        unmount();

        const snapshot = getLoadingAnalyticsSnapshot();
        expect(snapshot.active['loading-test-op']).toBeUndefined();
        expect(snapshot.history[0]?.id).toBe('loading-test-op');
        expect(snapshot.history[0]?.status).toBe('completed');
    });
});
