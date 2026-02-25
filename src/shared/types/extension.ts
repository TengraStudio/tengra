/**
 * Extension SDK Types
 * MKT-DEV-01: Extension SDK/templates/CLI
 */

import { JsonObject, JsonValue } from '@shared/types/common';

/** Extension manifest definition */
export interface ExtensionManifest {
    /** Extension ID (unique identifier) */
    id: string;
    /** Extension name */
    name: string;
    /** Extension version (semver) */
    version: string;
    /** Extension description */
    description: string;
    /** Author information */
    author: ExtensionAuthor;
    /** Extension category */
    category: ExtensionCategory;
    /** Keywords for search */
    keywords: string[];
    /** Extension entry point */
    main: string;
    /** Extension icon path */
    icon?: string;
    /** Extension README path */
    readme?: string;
    /** Extension license */
    license: string;
    /** Repository URL */
    repository?: string;
    /** Homepage URL */
    homepage?: string;
    /** Extension dependencies */
    dependencies?: Record<string, string>;
    /** Peer dependencies */
    peerDependencies?: Record<string, string>;
    /** Extension configuration schema */
    configuration?: ExtensionConfiguration;
    /** Extension permissions */
    permissions?: ExtensionPermission[];
    /** Extension capabilities */
    capabilities?: ExtensionCapability[];
    /** Minimum Tengra version required */
    tengraVersion?: string;
    /** Extension activation events */
    activationEvents?: ActivationEvent[];
    /** Extension contributes */
    contributes?: ExtensionContributes;
    /** Extension settings */
    settings?: ExtensionSetting[];
    /** Extension status */
    status?: ExtensionStatus;
}

/** Extension author information */
export interface ExtensionAuthor {
    name: string;
    email?: string;
    url?: string;
}

/** Extension categories */
export type ExtensionCategory =
    | 'ai'
    | 'productivity'
    | 'development'
    | 'integration'
    | 'theme'
    | 'language'
    | 'data'
    | 'utility'
    | 'other';

/** Extension configuration schema */
export interface ExtensionConfiguration {
    /** Configuration properties */
    properties: Record<string, ConfigurationProperty>;
    /** Required properties */
    required?: string[];
}

/** Configuration property definition */
export interface ConfigurationProperty {
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';
    title: string;
    description: string;
    default?: JsonValue;
    enum?: string[];
    minimum?: number;
    maximum?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
}

/** Extension permissions */
export type ExtensionPermission =
    | 'filesystem'
    | 'network'
    | 'process'
    | 'clipboard'
    | 'notifications'
    | 'database'
    | 'git'
    | 'terminal'
    | 'ai';

/** Extension capabilities */
export type ExtensionCapability =
    | 'mcp-server'
    | 'mcp-client'
    | 'ui-panel'
    | 'command'
    | 'theme'
    | 'language-model'
    | 'embedding-model'
    | 'tool';

/** Activation events */
export type ActivationEvent =
    | { type: 'onStartup' }
    | { type: 'onCommand'; command: string }
    | { type: 'onLanguage'; languageId: string }
    | { type: 'onFileSystem'; scheme: string }
    | { type: 'onView'; viewId: string }
    | { type: 'onFileOpen'; glob: string }
    | { type: 'onAction'; action: string };

/** Extension contributes */
export interface ExtensionContributes {
    commands?: ExtensionCommand[];
    menus?: ExtensionMenu[];
    views?: ExtensionView[];
    themes?: ExtensionTheme[];
    languages?: ExtensionLanguage[];
    tools?: ExtensionTool[];
}

/** Extension command contribution */
export interface ExtensionCommand {
    id: string;
    title: string;
    category?: string;
    icon?: string;
    keybinding?: string;
}

/** Extension menu contribution */
export interface ExtensionMenu {
    id: string;
    label: string;
    command: string;
    group?: string;
    when?: string;
}

/** Extension view contribution */
export interface ExtensionView {
    id: string;
    title: string;
    type: 'panel' | 'sidebar' | 'editor';
    icon?: string;
    when?: string;
}

/** Extension theme contribution */
export interface ExtensionTheme {
    id: string;
    label: string;
    type: 'light' | 'dark' | 'high-contrast';
    path: string;
}

/** Extension language contribution */
export interface ExtensionLanguage {
    id: string;
    extensions: string[];
    aliases?: string[];
    configuration?: string;
}

/** Extension tool contribution */
export interface ExtensionTool {
    id: string;
    name: string;
    description: string;
    inputSchema: JsonObject;
    handler: string;
}

/** Extension setting */
export interface ExtensionSetting {
    key: string;
    value: JsonValue;
    scope: 'global' | 'workspace' | 'folder';
}

/** Extension status */
export type ExtensionStatus =
    | 'active'
    | 'inactive'
    | 'installed'
    | 'disabled'
    | 'error'
    | 'loading';

/** Extension runtime context */
export interface ExtensionContext {
    /** Extension ID */
    extensionId: string;
    /** Extension path */
    extensionPath: string;
    /** Global state storage */
    globalState: ExtensionState;
    /** Workspace state storage */
    workspaceState: ExtensionState;
    /** Extension subscriptions */
    subscriptions: Disposable[];
    /** Extension logger */
    logger: ExtensionLogger;
    /** Extension configuration */
    configuration: ExtensionConfigAccessor;
}

/** Extension state storage */
export interface ExtensionState {
    get<T>(key: string): T | undefined;
    get<T>(key: string, defaultValue: T): T;
    set(key: string, value: JsonValue): Promise<void>;
    delete(key: string): Promise<void>;
    keys(): string[];
}

/** Extension logger */
export interface ExtensionLogger {
    info(message: string, ...args: JsonValue[]): void;
    warn(message: string, ...args: JsonValue[]): void;
    error(message: string, error?: Error): void;
    debug(message: string, ...args: JsonValue[]): void;
}

/** Extension configuration accessor */
export interface ExtensionConfigAccessor {
    get<T>(section: string): T | undefined;
    get<T>(section: string, defaultValue: T): T;
    update(section: string, value: JsonValue): Promise<void>;
    has(section: string): boolean;
    onDidChange: (listener: (event: ConfigurationChangeEvent) => void) => Disposable;
}

/** Configuration change event */
export interface ConfigurationChangeEvent {
    affectsConfiguration(section: string): boolean;
}

/** Disposable interface */
export interface Disposable {
    dispose(): void;
}

/** Extension activation function type */
export type ExtensionActivateFunction = (context: ExtensionContext) => Promise<void> | void;

/** Extension deactivation function type */
export type ExtensionDeactivateFunction = () => Promise<void> | void;

/** Extension module interface */
export interface ExtensionModule {
    activate: ExtensionActivateFunction;
    deactivate?: ExtensionDeactivateFunction;
}

/** Extension API exposed to extensions */
export interface ExtensionAPI {
    /** Extension context */
    context: ExtensionContext;
    /** Register a command */
    registerCommand(command: ExtensionCommand, handler: (...args: JsonValue[]) => JsonValue | Promise<JsonValue>): Disposable;
    /** Register a tool */
    registerTool(tool: ExtensionTool, handler: (args: JsonObject) => Promise<JsonValue>): Disposable;
    /** Register a view */
    registerView(view: ExtensionView, provider: ViewProvider): Disposable;
    /** Show a message */
    showMessage(message: string, type?: 'info' | 'warn' | 'error'): Promise<void>;
    /** Show an input box */
    showInput(options: InputBoxOptions): Promise<string | undefined>;
    /** Show a quick pick */
    showQuickPick(items: QuickPickItem[], options?: QuickPickOptions): Promise<QuickPickItem | undefined>;
    /** Execute a command */
    executeCommand<T>(command: string, ...args: JsonValue[]): Promise<T>;
    /** Get configuration */
    getConfiguration(section?: string): ExtensionConfigAccessor;
    /** Create a terminal */
    createTerminal(options: TerminalOptions): Terminal;
    /** Register a text document content provider */
    registerTextDocumentContentProvider(scheme: string, provider: TextDocumentContentProvider): Disposable;
}

/** View provider interface */
export interface ViewProvider {
    resolveView(container: ViewContainer): void;
}

/** View container interface */
export interface ViewContainer {
    element: HTMLElement;
    onDidChangeVisibility: (listener: () => void) => Disposable;
    onDidChangeSize: (listener: (width: number, height: number) => void) => Disposable;
}

/** Input box options */
export interface InputBoxOptions {
    prompt?: string;
    placeholder?: string;
    value?: string;
    password?: boolean;
    validateInput?: (value: string) => string | undefined;
}

/** Quick pick item */
export interface QuickPickItem {
    label: string;
    description?: string;
    detail?: string;
    picked?: boolean;
}

/** Quick pick options */
export interface QuickPickOptions {
    placeholder?: string;
    canPickMany?: boolean;
    matchOnDescription?: boolean;
    matchOnDetail?: boolean;
}

/** Terminal options */
export interface TerminalOptions {
    name: string;
    cwd?: string;
    env?: Record<string, string>;
    shellPath?: string;
    shellArgs?: string[];
}

/** Terminal interface */
export interface Terminal {
    sendText(text: string): void;
    show(): void;
    hide(): void;
    dispose(): void;
    onDidClose: (listener: () => void) => Disposable;
}

/** Text document content provider */
export interface TextDocumentContentProvider {
    provideTextDocumentContent(uri: string): Promise<string>;
}

/** Extension statistics */
export interface ExtensionStats {
    extensionId: string;
    downloads: number;
    rating: number;
    ratingCount: number;
    installCount: number;
    updateCount: number;
    lastUpdated: string;
    createdAt: string;
}

/** Extension publish options */
export interface ExtensionPublishOptions {
    /** Extension path */
    extensionPath: string;
    /** Registry URL */
    registryUrl?: string;
    /** Access token */
    token: string;
    /** Skip validation */
    skipValidation?: boolean;
    /** Dry run */
    dryRun?: boolean;
}

/** Extension publish result */
export interface ExtensionPublishResult {
    success: boolean;
    extensionId?: string;
    version?: string;
    error?: string;
    warnings?: string[];
}

/** Extension development options */
export interface ExtensionDevOptions {
    /** Extension path */
    extensionPath: string;
    /** Watch for changes */
    watch?: boolean;
    /** Hot reload */
    hotReload?: boolean;
    /** Debug mode */
    debug?: boolean;
    /** Port for dev server */
    port?: number;
}

/** Extension development server */
export interface ExtensionDevServer {
    /** Start the dev server */
    start(): Promise<void>;
    /** Stop the dev server */
    stop(): Promise<void>;
    /** Reload extension */
    reload(): Promise<void>;
    /** Get server status */
    status(): DevServerStatus;
    /** On reload event */
    onReload: (listener: () => void) => Disposable;
    /** On error event */
    onError: (listener: (error: Error) => void) => Disposable;
}

/** Dev server status */
export type DevServerStatus = 'stopped' | 'starting' | 'running' | 'error';

/** Extension test options */
export interface ExtensionTestOptions {
    /** Extension path */
    extensionPath: string;
    /** Test pattern */
    testPattern?: string;
    /** Coverage */
    coverage?: boolean;
    /** Watch mode */
    watch?: boolean;
    /** Update snapshots */
    updateSnapshots?: boolean;
}

/** Extension test result */
export interface ExtensionTestResult {
    success: boolean;
    passed: number;
    failed: number;
    skipped: number;
    duration: number;
    coverage?: ExtensionTestCoverage;
}

/** Extension test coverage */
export interface ExtensionTestCoverage {
    lines: number;
    statements: number;
    branches: number;
    functions: number;
}

/** Extension profile data */
export interface ExtensionProfileData {
    extensionId: string;
    memoryUsage: number;
    cpuUsage: number;
    activationTime: number;
    callCount: number;
    errorCount: number;
    lastError?: string;
    timestamps: {
        activated?: number;
        lastCall?: number;
        deactivated?: number;
    };
}


