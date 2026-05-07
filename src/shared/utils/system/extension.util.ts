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
 * Extension SDK Utilities
 * MKT-DEV-01: Extension SDK/templates/CLI
 */

import { JsonObject, JsonValue } from '@shared/types/common';
import {
    Disposable,
    ExtensionCommand,
    ExtensionConfigAccessor,
    ExtensionContext,
    ExtensionLogger,
    ExtensionManifest,
    ExtensionState,
    ExtensionTool,
    ExtensionView,
    InputBoxOptions,
    QuickPickItem,
    QuickPickOptions,
    Terminal,
    TerminalOptions,
    TextDocumentContentProvider,
    ViewProvider,
} from '@shared/types/system/extension';

/** Create a disposable from a callback */
export function createDisposable(callback: () => void): Disposable {
    return { dispose: callback };
}

/** Combine multiple disposables into one */
export function combineDisposables(...disposables: Disposable[]): Disposable {
    return createDisposable(() => {
        for (const disposable of disposables) {
            try {
                disposable.dispose();
            } catch {
                // Ignore disposal errors
            }
        }
    });
}

/** Create an extension state storage */
export function createExtensionState(_storageKey: string): ExtensionState {
    const storage = new Map<string, JsonValue>();

    return {
        get<T>(key: string, defaultValue?: T): T | undefined {
            const value = storage.get(key);
            if (value === undefined) {
                return defaultValue;
            }
            return value as T;
        },
        async set(key: string, value: JsonValue): Promise<void> {
            storage.set(key, value);
        },
        async delete(key: string): Promise<void> {
            storage.delete(key);
        },
        keys(): string[] {
            return Array.from(storage.keys());
        },
    };
}

/** Create an extension logger */
export function createExtensionLogger(
    extensionId: string,
    targetLogger?: ExtensionLogger
): ExtensionLogger {
    const prefix = `[Extension: ${extensionId}]`;
    const noopLogger: ExtensionLogger = {
        info: () => undefined,
        warn: () => undefined,
        error: () => undefined,
        debug: () => undefined,
    };
    const resolvedLogger = targetLogger ?? noopLogger;

    return {
        info(message: string, ...args: JsonValue[]): void {
            resolvedLogger.info(`${prefix} ${message}`, ...args);
        },
        warn(message: string, ...args: JsonValue[]): void {
            resolvedLogger.warn(`${prefix} ${message}`, ...args);
        },
        error(message: string, error?: Error): void {
            resolvedLogger.error(`${prefix} ${message}`, error);
        },
        debug(message: string, ...args: JsonValue[]): void {
            resolvedLogger.debug(`${prefix} ${message}`, ...args);
        },
    };
}

/** Validate required manifest scalar fields. */
function validateRequiredFields(m: Partial<ExtensionManifest>): string[] {
    const errors: string[] = [];

    if (!m.id || typeof m.id !== 'string') {
        errors.push('Missing required field: id');
    } else if (!/^[a-z0-9-]+\.[a-z0-9-]+$/.test(m.id)) {
        errors.push('Invalid id format. Expected: publisher.extension-name');
    }

    if (!m.name || typeof m.name !== 'string') {
        errors.push('Missing required field: name');
    }

    if (!m.version || typeof m.version !== 'string') {
        errors.push('Missing required field: version');
    } else if (!/^\d+\.\d+\.\d+(-[a-z0-9.]+)?$/.test(m.version)) {
        errors.push('Invalid version format. Expected semver (e.g., 1.0.0)');
    }

    if (!m.description || typeof m.description !== 'string') {
        errors.push('Missing required field: description');
    }
    if (!m.main || typeof m.main !== 'string') {
        errors.push('Missing required field: main');
    }
    if (!m.license || typeof m.license !== 'string') {
        errors.push('Missing required field: license');
    }

    return errors;
}

/** Validate the author object in a manifest. */
function validateAuthor(m: Partial<ExtensionManifest>): string[] {
    if (!m.author || typeof m.author !== 'object') {
        return ['Missing required field: author'];
    }
    if (!m.author.name || typeof m.author.name !== 'string') {
        return ['Missing required field: author.name'];
    }
    return [];
}

/** Validate optional manifest array/object fields. */
function validateOptionalFields(m: Partial<ExtensionManifest>): string[] {
    const errors: string[] = [];
    if (m.permissions && !Array.isArray(m.permissions)) {
        errors.push('Field "permissions" must be an array');
    }
    if (m.capabilities && !Array.isArray(m.capabilities)) {
        errors.push('Field "capabilities" must be an array');
    }
    if (m.activationEvents && !Array.isArray(m.activationEvents)) {
        errors.push('Field "activationEvents" must be an array');
    }
    if (m.dependencies && typeof m.dependencies !== 'object') {
        errors.push('Field "dependencies" must be an object');
    }
    return errors;
}

/** Validate extension manifest */
export function validateManifest(manifest: RuntimeValue): { valid: boolean; errors: string[] } {
    if (!manifest || typeof manifest !== 'object') {
        return { valid: false, errors: ['Manifest must be an object'] };
    }

    const m = manifest as Partial<ExtensionManifest>;
    const errors = [
        ...validateRequiredFields(m),
        ...validateAuthor(m),
        ...validateOptionalFields(m),
    ];

    return { valid: errors.length === 0, errors };
}

/** Generate extension ID from publisher and name */
export function generateExtensionId(publisher: string, name: string): string {
    const normalizedPublisher = publisher.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const normalizedName = name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    return `${normalizedPublisher}.${normalizedName}`;
}

/** Parse extension ID into publisher and name */
export function parseExtensionId(extensionId: string): { publisher: string; name: string } | null {
    const parts = extensionId.split('.');
    if (parts.length !== 2) {
        return null;
    }
    return { publisher: parts[0], name: parts[1] };
}

/** Compare extension versions */
export function compareVersions(a: string, b: string): number {
    const parseVersion = (v: string): number[] => {
        const parts = v.split('-')[0].split('.');
        return parts.map((p) => parseInt(p, 10) || 0);
    };

    const aParts = parseVersion(a);
    const bParts = parseVersion(b);

    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
        const aVal = aParts[i] || 0;
        const bVal = bParts[i] || 0;
        if (aVal > bVal) {
            return 1;
        }
        if (aVal < bVal) {
            return -1;
        }
    }

    return 0;
}

/** Check if version satisfies a range */
export function satisfiesVersion(version: string, range: string): boolean {
    // Simple implementation: supports exact version and ^ ranges
    if (range === '*') {
        return true;
    }
    if (range === version) {
        return true;
    }

    if (range.startsWith('^')) {
        const minVersion = range.slice(1);
        return compareVersions(version, minVersion) >= 0;
    }

    if (range.startsWith('>=')) {
        const minVersion = range.slice(2);
        return compareVersions(version, minVersion) >= 0;
    }

    return false;
}

/** Create default extension manifest */
export function createDefaultManifest(options: {
    id: string;
    name: string;
    description: string;
    author: string;
}): ExtensionManifest {
    return {
        id: options.id,
        name: options.name,
        version: '1.0.0',
        description: options.description,
        author: {
            name: options.author,
        },
        category: 'other',
        keywords: [],
        main: './dist/extension.js',
        license: 'MIT',
        permissions: [],
        capabilities: [],
        activationEvents: [{ type: 'onStartup' }],
        settings: [],
    };
}

/** Extension command registry */
export class ExtensionCommandRegistry {
    private commands = new Map<string, { command: ExtensionCommand; handler: (...args: JsonValue[]) => JsonValue | Promise<JsonValue> }>();

    /** Register a command with its handler. */
    register(
        command: ExtensionCommand,
        handler: (...args: JsonValue[]) => JsonValue | Promise<JsonValue>
    ): Disposable {
        this.commands.set(command.id, { command, handler });
        return createDisposable(() => this.commands.delete(command.id));
    }

    /** Get a command entry by ID. */
    get(commandId: string): { command: ExtensionCommand; handler: (...args: JsonValue[]) => JsonValue | Promise<JsonValue> } | undefined {
        return this.commands.get(commandId);
    }

    /** Get all registered commands. */
    getAll(): ExtensionCommand[] {
        return Array.from(this.commands.values()).map((c) => c.command);
    }

    /** Execute a registered command by ID. */
    async execute<T>(commandId: string, ...args: JsonValue[]): Promise<T> {
        const entry = this.commands.get(commandId);
        if (!entry) {
            throw new Error(`Command not found: ${commandId}`);
        }
        return entry.handler(...args) as Promise<T>;
    }
}

/** Extension tool registry */
export class ExtensionToolRegistry {
    private tools = new Map<string, { tool: ExtensionTool; handler: (args: JsonObject) => Promise<JsonValue> }>();

    /** Register a tool with its handler. */
    register(tool: ExtensionTool, handler: (args: JsonObject) => Promise<JsonValue>): Disposable {
        this.tools.set(tool.id, { tool, handler });
        return createDisposable(() => this.tools.delete(tool.id));
    }

    /** Get a tool entry by ID. */
    get(toolId: string): { tool: ExtensionTool; handler: (args: JsonObject) => Promise<JsonValue> } | undefined {
        return this.tools.get(toolId);
    }

    /** Get all registered tools. */
    getAll(): ExtensionTool[] {
        return Array.from(this.tools.values()).map((t) => t.tool);
    }

    /** Execute a registered tool by ID. */
    async execute<T>(toolId: string, args: JsonObject): Promise<T> {
        const entry = this.tools.get(toolId);
        if (!entry) {
            throw new Error(`Tool not found: ${toolId}`);
        }
        return entry.handler(args) as Promise<T>;
    }
}

/** Extension view registry */
export class ExtensionViewRegistry {
    private views = new Map<string, { view: ExtensionView; provider: ViewProvider }>();

    /** Register a view with its provider. */
    register(view: ExtensionView, provider: ViewProvider): Disposable {
        this.views.set(view.id, { view, provider });
        return createDisposable(() => this.views.delete(view.id));
    }

    /** Get a view entry by ID. */
    get(viewId: string): { view: ExtensionView; provider: ViewProvider } | undefined {
        return this.views.get(viewId);
    }

    /** Get all registered views. */
    getAll(): ExtensionView[] {
        return Array.from(this.views.values()).map((v) => v.view);
    }
}

/** Extension API implementation */
export class ExtensionAPIImpl {
    private commandRegistry = new ExtensionCommandRegistry();
    private toolRegistry = new ExtensionToolRegistry();
    private viewRegistry = new ExtensionViewRegistry();

    constructor(public readonly context: ExtensionContext) { }

    /** Register a command and track its subscription. */
    registerCommand(
        command: ExtensionCommand,
        handler: (...args: JsonValue[]) => JsonValue | Promise<JsonValue>
    ): Disposable {
        const disposable = this.commandRegistry.register(command, handler);
        this.context.subscriptions.push(disposable);
        return disposable;
    }

    /** Register a tool and track its subscription. */
    registerTool(tool: ExtensionTool, handler: (args: JsonObject) => Promise<JsonValue>): Disposable {
        const disposable = this.toolRegistry.register(tool, handler);
        this.context.subscriptions.push(disposable);
        return disposable;
    }

    /** Register a view and track its subscription. */
    registerView(view: ExtensionView, provider: ViewProvider): Disposable {
        const disposable = this.viewRegistry.register(view, provider);
        this.context.subscriptions.push(disposable);
        return disposable;
    }

    /** Show a message via the extension logger. */
    async showMessage(message: string, type: 'info' | 'warn' | 'error' = 'info'): Promise<void> {
        this.context.logger[type](message);
    }

    /** Show an input dialog with validation support. */
    async showInput(options: InputBoxOptions): Promise<string | undefined> {
        // Headless fallback: we can only return provided defaults when host UI input is unavailable.
        if (typeof options.value === 'string') {
            const validationError = options.validateInput?.(options.value);
            if (validationError) {
                this.context.logger.warn(`showInput validation failed: ${validationError}`);
                return undefined;
            }
            return options.value;
        }

        this.context.logger.warn('showInput is unavailable in the current host context');
        return undefined;
    }

    /** Show a quick pick dialog. */
    async showQuickPick(items: QuickPickItem[], _options?: QuickPickOptions): Promise<QuickPickItem | undefined> {
        // This would be implemented by the host application
        return items[0];
    }

    /** Execute a registered command by name. */
    async executeCommand<T>(command: string, ...args: JsonValue[]): Promise<T> {
        return this.commandRegistry.execute<T>(command, ...args);
    }

    /** Get the extension configuration accessor. */
    getConfiguration(_section?: string): ExtensionConfigAccessor {
        return this.context.configuration;
    }

    /** Create a terminal instance. */
    createTerminal(_options: TerminalOptions): Terminal {
        // This would be implemented by the host application
        throw new Error('Terminal creation not implemented');
    }

    /** Register a text document content provider for a given scheme. */
    registerTextDocumentContentProvider(_scheme: string, _provider: TextDocumentContentProvider): Disposable {
        // This would be implemented by the host application
        return createDisposable(() => { });
    }
}

export type { ExtensionAPIImpl as ExtensionAPI };

