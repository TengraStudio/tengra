/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import type { Monaco as MonacoReactType } from '@monaco-editor/react';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

type MonacoModule = typeof import('monaco-editor/esm/vs/editor/editor.api');
type MonacoWorkerFactory = new () => Worker;
interface MonacoTypeScriptDefaults {
    setEagerModelSync(value: boolean): void;
    setCompilerOptions(options: Record<string, boolean | number>): void;
    setDiagnosticsOptions(options: {
        noSemanticValidation: boolean;
        noSyntaxValidation: boolean;
        noSuggestionDiagnostics: boolean;
    }): void;
}

interface MonacoTypeScriptApi {
    JsxEmit: { ReactJSX: number };
    ModuleResolutionKind: { NodeJs: number };
    ModuleKind: { ESNext: number };
    ScriptTarget: { ES2022: number };
    javascriptDefaults: MonacoTypeScriptDefaults;
    typescriptDefaults: MonacoTypeScriptDefaults;
}

let monacoInitPromise: Promise<MonacoModule> | null = null;
let monacoEnvironmentConfigured = false;
let monacoDefaultsConfigured = false;

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
    Object.assign(globalThis, {
        MonacoEnvironment: {
            getWorker: (_workerId: string, label: string) => getMonacoWorker(label),
        },
    });
    monacoEnvironmentConfigured = true;
}

function configureMonacoLanguageDefaults(monaco: MonacoModule): void {
    if (monacoDefaultsConfigured) {
        return;
    }

    const typeScriptApi = monaco.languages.typescript as never as MonacoTypeScriptApi;
    const compilerOptions: Record<string, boolean | number> = {
        allowJs: true,
        allowNonTsExtensions: true,
        jsx: typeScriptApi.JsxEmit.ReactJSX,
        moduleResolution: typeScriptApi.ModuleResolutionKind.NodeJs,
        module: typeScriptApi.ModuleKind.ESNext,
        target: typeScriptApi.ScriptTarget.ES2022,
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        esModuleInterop: true,
        resolveJsonModule: true,
        isolatedModules: true,
    };

    typeScriptApi.javascriptDefaults.setEagerModelSync(true);
    typeScriptApi.typescriptDefaults.setEagerModelSync(true);
    typeScriptApi.javascriptDefaults.setCompilerOptions(compilerOptions);
    typeScriptApi.typescriptDefaults.setCompilerOptions(compilerOptions);
    typeScriptApi.javascriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: true,
        noSyntaxValidation: true,
        noSuggestionDiagnostics: true,
    });
    typeScriptApi.typescriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: true,
        noSyntaxValidation: true,
        noSuggestionDiagnostics: true,
    });

    monacoDefaultsConfigured = true;
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
            import('monaco-editor/esm/vs/editor/editor.api')
        ]);

        ensureMonacoEnvironment();
        configureMonacoLanguageDefaults(monaco);
        const monacoForLoader: MonacoReactType = monaco;
        loader.config({ monaco: monacoForLoader });
        await loader.init();
        return monaco;
    })();

    return monacoInitPromise;
}
