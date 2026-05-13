/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * Entry point for the Main process.
 */

import { EarlyIpc } from './startup/minimal-ipc';
import { initializeAppPaths } from './startup/paths';
import { getMainWindow } from './startup/window';

/**
 * STARTUP SEQUENCE
 * 1. initializeAppPaths() initializes Electron userData/paths first.
 * 2. EarlyIpc Manager sets up minimal handlers to prevent renderer hangs.
 * 3. Dynamic import of 'app' ensures environment is stable before loading heavy logic.
 */
initializeAppPaths();
EarlyIpc.initialize(getMainWindow);

// Defer main application load to the next tick to ensure
// all module side-effects from early boot are completed.
setTimeout(() => {
    void import('./app').catch(err => {
        console.error('[CRITICAL] Failed to load application logic:', err);
        process.exit(1);
    });
}, 0);

