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
