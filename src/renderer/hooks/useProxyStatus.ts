/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * Hook for tracking proxy embed status with loading, error, and empty states.
 * Provides reactive UI state for ProxyService lifecycle.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { useTranslation } from '@/i18n';

/** Possible UI states for the proxy embed service */
export type ProxyUiState = 'idle' | 'loading' | 'running' | 'stopped' | 'error';

/** Proxy status snapshot exposed to UI components */
export interface ProxyStatusSnapshot {
  /** Current UI state */
  uiState: ProxyUiState;
  /** Whether the proxy process is running */
  running: boolean;
  /** Port the proxy is listening on */
  port: number | null;
  /** Process ID of the proxy */
  pid: number | null;
  /** Human-readable error message (translated) */
  errorMessage: string | null;
  /** Raw error code from ProxyServiceError */
  errorCode: string | null;
  /** Whether the current error is retryable */
  retryable: boolean;
  /** Timestamp of the last successful status check */
  lastCheckedAt: number | null;
}

const INITIAL_SNAPSHOT: ProxyStatusSnapshot = {
  uiState: 'idle',
  running: false,
  port: null,
  pid: null,
  errorMessage: null,
  errorCode: null,
  retryable: false,
  lastCheckedAt: null,
};

const POLL_INTERVAL_MS = 10_000;
const MAX_POLL_INTERVAL_MS = 30_000;

interface RawProxyStatus {
  running?: boolean;
  pid?: number;
  port?: number;
  error?: string;
  errorCode?: string;
}

/**
 * Maps raw error codes to translation keys for user-facing messages.
 */
function errorCodeToMessageKey(code: string): string {
  const mapping: Record<string, string> = {
    PROXY_START_FAILED: 'errors.proxy.startFailed',
    PROXY_STOP_FAILED: 'errors.proxy.stopFailed',
    PROXY_CONNECTION_FAILED: 'errors.proxy.connectionFailed',
    PROXY_REQUEST_FAILED: 'errors.proxy.requestFailed',
    PROXY_PORT_IN_USE: 'errors.proxy.portInUse',
    PROXY_BINARY_NOT_FOUND: 'errors.proxy.binaryNotFound',
    PROXY_NOT_INITIALIZED: 'errors.proxy.notInitialized',
    PROXY_INVALID_CONFIG: 'errors.proxy.invalidConfig',
    PROXY_AUTH_FAILED: 'errors.proxy.authFailed',
    PROXY_TIMEOUT: 'errors.proxy.timeout',
  };
  return mapping[code] ?? 'errors.proxy.requestFailed';
}

/**
 * Hook that polls proxy embed status and exposes a reactive UI state.
 * @param enabled - Whether polling should be active (default true)
 * @returns ProxyStatusSnapshot and control functions
 */
export function useProxyStatus(enabled = true) {
  const { t } = useTranslation();
  const [snapshot, setSnapshot] = useState<ProxyStatusSnapshot>(INITIAL_SNAPSHOT);
  const pollIntervalRef = useRef(POLL_INTERVAL_MS);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const api = window.electron?.proxyEmbed;
      if (!api) {
        return;
      }
      const raw = (await api.status()) as RawProxyStatus;
      const running = raw.running === true;

      if (raw.error || raw.errorCode) {
        const messageKey = raw.errorCode
          ? errorCodeToMessageKey(raw.errorCode)
          : 'errors.proxy.requestFailed';
        setSnapshot({
          uiState: 'error',
          running: false,
          port: raw.port ?? null,
          pid: raw.pid ?? null,
          errorMessage: t(messageKey, { port: raw.port ?? 0 }),
          errorCode: raw.errorCode ?? null,
          retryable: raw.errorCode !== 'PROXY_INVALID_CONFIG',
          lastCheckedAt: Date.now(),
        });
        return;
      }

      setSnapshot({
        uiState: running ? 'running' : 'stopped',
        running,
        port: raw.port ?? null,
        pid: raw.pid ?? null,
        errorMessage: null,
        errorCode: null,
        retryable: false,
        lastCheckedAt: Date.now(),
      });
      pollIntervalRef.current = POLL_INTERVAL_MS;
    } catch {
      pollIntervalRef.current = Math.min(
        pollIntervalRef.current * 2,
        MAX_POLL_INTERVAL_MS
      );
    }
  }, [t]);

  /** Manually refresh status */
  const refresh = useCallback(() => {
    void fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    timerRef.current = setTimeout(() => {
      void fetchStatus();
    }, 0);

    const startPoll = () => {
      timerRef.current = setTimeout(() => {
        void fetchStatus().then(() => {
          startPoll();
        });
      }, pollIntervalRef.current);
    };
    startPoll();

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [enabled, fetchStatus]);

  return { ...snapshot, refresh };
}
