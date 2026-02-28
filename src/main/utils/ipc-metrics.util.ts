import { appLogger } from '@main/logging/logger'
import { IpcMainInvokeEvent } from 'electron'

/** Metrics snapshot for a single IPC channel. */
export interface IpcChannelMetrics {
  channel: string
  callCount: number
  errorCount: number
  avgDurationMs: number
  maxDurationMs: number
}

interface ChannelStats {
  callCount: number
  errorCount: number
  totalDurationMs: number
  maxDurationMs: number
}

const metricsStore = new Map<string, ChannelStats>()

/**
 * Wraps an IPC handler function to collect timing and error metrics.
 * @param channel - The IPC channel name
 * @param handler - The original handler function
 * @returns A wrapped handler that records metrics before delegating
 */
export function withIpcMetrics<TArgs extends unknown[], TResult>(
  channel: string,
  handler: (event: IpcMainInvokeEvent, ...args: TArgs) => Promise<TResult>
): (event: IpcMainInvokeEvent, ...args: TArgs) => Promise<TResult> {
  return async (event: IpcMainInvokeEvent, ...args: TArgs): Promise<TResult> => {
    const start = performance.now()
    let stats = metricsStore.get(channel)
    if (!stats) {
      stats = { callCount: 0, errorCount: 0, totalDurationMs: 0, maxDurationMs: 0 }
      metricsStore.set(channel, stats)
    }
    stats.callCount++

    try {
      const result = await handler(event, ...args)
      return result
    } catch (error) {
      stats.errorCount++
      appLogger.warn('IpcMetrics', `Error on channel ${channel}`, error as Error)
      throw error
    } finally {
      const duration = performance.now() - start
      stats.totalDurationMs += duration
      if (duration > stats.maxDurationMs) {
        stats.maxDurationMs = duration
      }
    }
  }
}

/**
 * Returns a snapshot of metrics for all tracked IPC channels.
 */
export function getIpcMetrics(): IpcChannelMetrics[] {
  const results: IpcChannelMetrics[] = []
  for (const [channel, stats] of metricsStore) {
    results.push({
      channel,
      callCount: stats.callCount,
      errorCount: stats.errorCount,
      avgDurationMs: stats.callCount > 0 ? stats.totalDurationMs / stats.callCount : 0,
      maxDurationMs: stats.maxDurationMs
    })
  }
  return results
}

/** Resets all collected IPC metrics. Useful for testing. */
export function resetIpcMetrics(): void {
  metricsStore.clear()
}
