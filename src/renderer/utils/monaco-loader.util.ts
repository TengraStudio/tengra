import type { Monaco as MonacoReactType } from '@monaco-editor/react';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

type MonacoModule = typeof import('monaco-editor');
type MonacoWorkerFactory = new () => Worker;

let monacoInitPromise: Promise<MonacoModule> | null = null;
let monacoEnvironmentConfigured = false;

function getMonacoWorker(label: string): Worker {
    const workerFactory: MonacoWorkerFactory =
        label === 'json'
            ? jsonWorker
            : label === 'css' || label === 'scss' || label === 'less'
                ? cssWorker
                : label === 'html' || label === 'handlebars' || label === 'razor'
                    ? htmlWorker
                    : label === 'typescript' || label === 'javascript'
                        ? tsWorker
                        : editorWorker;
    return new workerFactory();
}

function ensureMonacoEnvironment(): void {
    if (monacoEnvironmentConfigured) {
        return;
    }
    globalThis.MonacoEnvironment = {
        getWorker: (_workerId: string, label: string) => getMonacoWorker(label),
    };
    monacoEnvironmentConfigured = true;
}

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

        ensureMonacoEnvironment();
        const monacoForLoader: MonacoReactType = monaco;
        loader.config({ monaco: monacoForLoader });
        await loader.init();
        return monaco;
    })();

    return monacoInitPromise;
}
