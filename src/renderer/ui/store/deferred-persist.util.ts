/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

interface DeferredPersistOptions {
    delayMs: number;
    persist: () => void;
}

interface DeferredPersistController {
    schedule: () => void;
    cancel: () => void;
    flush: () => void;
}

export function createDeferredPersist(options: DeferredPersistOptions): DeferredPersistController {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const cancel = (): void => {
        if (timer === null) {
            return;
        }
        clearTimeout(timer);
        timer = null;
    };

    const flush = (): void => {
        cancel();
        options.persist();
    };

    const schedule = (): void => {
        if (timer !== null) {
            return;
        }

        timer = setTimeout(() => {
            timer = null;
            options.persist();
        }, options.delayMs);
    };

    return { schedule, cancel, flush };
}
