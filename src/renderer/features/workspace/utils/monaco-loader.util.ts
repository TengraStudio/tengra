/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */


import { loader } from '@monaco-editor/react';
import { appLogger } from '@system/utils/renderer-logger';
import * as monacoCore from 'monaco-editor/esm/vs/editor/editor.api.js';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

import 'monaco-editor/esm/vs/language/json/monaco.contribution';
import 'monaco-editor/esm/vs/language/css/monaco.contribution';
import 'monaco-editor/esm/vs/language/html/monaco.contribution';
import 'monaco-editor/esm/vs/language/typescript/monaco.contribution';

type MonacoModule = typeof monacoCore;
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
    if (!typeScriptApi?.JsxEmit) {
        console.warn('[MonacoLoader] TypeScript API or JsxEmit not available, skipping compiler options configuration');
        return;
    }

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
 * Configure Monaco loader to use local bundled Monaco.
 */
export async function ensureMonacoInitialized(): Promise<MonacoModule> {
    if (monacoInitPromise) {
        return monacoInitPromise;
    }

    monacoInitPromise = (async () => {
        try {
            ensureMonacoEnvironment();

            // Config loader to use our statically imported monaco instance
            loader.config({
                monaco: monacoCore
            });

            const monaco = await loader.init();
            configureMonacoLanguageDefaults(monaco);

            return monaco;
        } catch (error) {
            appLogger.error('MonacoLoader', 'Initialization failed', error as Error);
            throw error;
        }
    })();

    return monacoInitPromise;
}

