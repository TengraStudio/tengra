import type { Monaco as MonacoReactType } from '@monaco-editor/react';

type MonacoModule = typeof import('monaco-editor');

let monacoInitPromise: Promise<MonacoModule> | null = null;

/**
 * Configure Monaco loader to use local bundled Monaco instead of CDN.
 * Prevents CSP violations (blocked jsdelivr loader.js).
 */
export async function ensureMonacoInitialized(): Promise<MonacoModule> {
    if (monacoInitPromise) {
        return monacoInitPromise;
    }

    monacoInitPromise = (async () => {
        const [{ loader }, monaco] = await Promise.all([
            import('@monaco-editor/react'),
            import('monaco-editor')
        ]);

        loader.config({ monaco: monaco as unknown as MonacoReactType });
        await loader.init();
        return monaco;
    })();

    return monacoInitPromise;
}

