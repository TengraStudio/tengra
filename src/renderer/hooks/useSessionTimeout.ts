/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { useEffect, useMemo, useRef, useState } from 'react';

type SessionTimeoutState = {
    isEnabled: boolean;
    isLocked: boolean;
    timeoutMs: number;
    lockedAt?: number;
    canUseBiometric: boolean;
};

type SessionTimeoutActions = {
    unlock: () => void;
};

const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000;
const TOUCH_INTERVAL_MS = 30_000;

export function useSessionTimeout(): SessionTimeoutState & SessionTimeoutActions {
    const [isEnabled, setIsEnabled] = useState(false);
    const [isLocked, setIsLocked] = useState(false);
    const [timeoutMs, setTimeoutMs] = useState(DEFAULT_TIMEOUT_MS);
    const [lockedAt, setLockedAt] = useState<number | undefined>(undefined);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [canUseBiometric, setCanUseBiometric] = useState(false);

    const lastActivityRef = useRef(0);
    const lastTouchRef = useRef(0);

    // Initialize lastActivityRef after mount
    useEffect(() => {
        lastActivityRef.current = Date.now();
    }, []);

    useEffect(() => {
        const init = async () => {
            try {
                const settings = await window.electron.getSettings();
                const sessionCfg = settings.security?.session;
                const enabled = sessionCfg?.enabled ?? false;
                const timeoutMinutes = sessionCfg?.timeoutMinutes ?? 30;
                const resolvedTimeoutMs = Math.max(1, timeoutMinutes) * 60 * 1000;

                setIsEnabled(enabled);
                setTimeoutMs(resolvedTimeoutMs);
                if (enabled) {
                    const session = await window.electron.startAuthSession('app', undefined, 'renderer-idle');
                    setSessionId(session.sessionId);
                    await window.electron.setAuthSessionTimeout(resolvedTimeoutMs);
                }
            } catch {
                setIsEnabled(false);
            }

            try {
                if (
                    typeof window.PublicKeyCredential !== 'undefined' &&
                    typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function'
                ) {
                    const available = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
                    setCanUseBiometric(available);
                }
            } catch {
                setCanUseBiometric(false);
            }
        };

        void init();
    }, []);

    useEffect(() => {
        if (!isEnabled) {
            return;
        }

        const touch = () => {
            const now = Date.now();
            lastActivityRef.current = now;
            if (!sessionId || (now - lastTouchRef.current) < TOUCH_INTERVAL_MS || isLocked) {
                return;
            }
            lastTouchRef.current = now;
            void window.electron.touchAuthSession(sessionId);
        };

        const events: Array<keyof WindowEventMap> = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];
        for (const eventName of events) {
            window.addEventListener(eventName, touch, { passive: true });
        }

        const timer = window.setInterval(() => {
            if (isLocked) {
                return;
            }
            if ((Date.now() - lastActivityRef.current) >= timeoutMs) {
                setIsLocked(true);
                setLockedAt(Date.now());
            }
        }, 10_000);

        return () => {
            for (const eventName of events) {
                window.removeEventListener(eventName, touch);
            }
            window.clearInterval(timer);
        };
    }, [isEnabled, isLocked, sessionId, timeoutMs]);

    useEffect(() => {
        return () => {
            if (sessionId) {
                void window.electron.endAuthSession(sessionId);
            }
        };
    }, [sessionId]);

    const unlock = useMemo(() => {
        return () => {
            setIsLocked(false);
            setLockedAt(undefined);
            lastActivityRef.current = Date.now();
            if (sessionId) {
                void window.electron.touchAuthSession(sessionId);
            }
        };
    }, [sessionId]);

    return {
        isEnabled,
        isLocked,
        timeoutMs,
        lockedAt,
        canUseBiometric,
        unlock,
    };
}

