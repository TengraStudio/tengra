import { _electron as electron, ElectronApplication, expect, Page, test } from '@playwright/test';
import type { App as NativeElectronApp } from 'electron';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const BUDGETS = {
    startupReadyMs: 3000,
    startupLoadMs: 4500,
    workspaceOpenMs: 2000,
    editorReadyMs: 2500,
    terminalReadyMs: 1500,
    mainHeapMb: 200,
    rendererHeapMb: 250,
    idleCpuPercent: 8,
};

const WORKSPACE_NAVIGATION_LABEL = /çalışma alanları|workspaces?/i;
const SETTINGS_NAVIGATION_LABEL = /ayarlar|settings/i;

interface PerformanceMemorySnapshot {
    usedJSHeapSize: number;
}

interface PerformanceWithMemory extends Performance {
    memory?: PerformanceMemorySnapshot;
}

interface TengraPerformanceMark {
    name: string;
    timestamp: number;
    duration?: number;
}

interface TengraPerformanceReport {
    marks: TengraPerformanceMark[];
    measures: TengraPerformanceMark[];
    totalTime: number;
}

interface WorkspaceFixture {
    id: string;
    title: string;
    rootPath: string;
    filePath: string;
}

interface StartupMetrics {
    startTime: number;
    readyTime?: number;
    loadTime?: number;
    deferredServicesReadyTime?: number;
}

interface PerformanceWorkspaceRecord {
    id: string;
    path: string;
}

test.describe('Performance Regression Guardrails', () => {
    let app: ElectronApplication;
    let page: Page;
    let startupMetrics: StartupMetrics;
    let overviewWorkspace: WorkspaceFixture;
    let editorWorkspace: WorkspaceFixture;

    test.beforeAll(async () => {
        seedManagedRuntimeManifestCache();
        const electronEnv = Object.fromEntries(
            Object.entries(process.env).filter(
                (entry): entry is [string, string] => typeof entry[1] === 'string'
            )
        );
        electronEnv.NODE_ENV = 'test';
        electronEnv.TENGRA_RUNTIME_MANIFEST_URL = 'https://127.0.0.1/runtime-manifest.json';

        delete electronEnv.ELECTRON_RUN_AS_NODE;
        
        app = await electron.launch({
            args: ['dist/main/main.js'],
            env: electronEnv
        });
        page = await waitForMainRendererWindow(app);

        await page.waitForSelector('body', { state: 'visible' });
        startupMetrics = await page.evaluate(async () => {
            const response = await window.electron.performance.getStartupMetrics() as {
                data?: StartupMetrics;
            } & StartupMetrics;
            return response.data ?? response;
        });

        overviewWorkspace = await createWorkspaceFixture(app, page, 'Performance Overview Workspace', false);
        editorWorkspace = await createWorkspaceFixture(app, page, 'Performance Editor Workspace', true);
        await page.reload();
        await page.waitForSelector('body', { state: 'visible' });
    });

    test.afterAll(async () => {
        if (page) {
            await cleanupWorkspaceFixture(page, overviewWorkspace);
            await cleanupWorkspaceFixture(page, editorWorkspace);
        }

        if (app) {
            await app.close();
        }

        await cleanupWorkspaceDirectory(overviewWorkspace?.rootPath);
        await cleanupWorkspaceDirectory(editorWorkspace?.rootPath);
    });

    test('OPT-005/OPT-012: Startup phases meet performance budget', async () => {
        expect((startupMetrics.readyTime ?? 0) - startupMetrics.startTime).toBeLessThan(
            BUDGETS.startupReadyMs
        );
        expect((startupMetrics.loadTime ?? 0) - startupMetrics.startTime).toBeLessThan(
            BUDGETS.startupLoadMs
        );
    });

    test('OPT-012: Main process heap memory meets budget', async () => {
        const metrics = await app.evaluate(() => process.memoryUsage());
        const heapUsedMb = metrics.heapUsed / 1024 / 1024;
        expect(heapUsedMb).toBeLessThan(BUDGETS.mainHeapMb);
    });

    test('OPT-012: Renderer process heap memory meets budget', async () => {
        const memory = await page.evaluate(() => {
            const perf = window.performance as PerformanceWithMemory;
            return perf.memory ? perf.memory.usedJSHeapSize / 1024 / 1024 : 0;
        });

        if (memory > 0) {
            expect(memory).toBeLessThan(BUDGETS.rendererHeapMb);
        } else {
            test.skip();
        }
    });

    test('OPT-012: Workspace open meets performance budget', async () => {
        await openWorkspace(page, overviewWorkspace.title);
        const duration = await measureDuration(
            page,
            'workspace:open:duration',
            'workspace:open:start',
            'workspace:dashboard:ready'
        );
        expect(duration).toBeLessThan(BUDGETS.workspaceOpenMs);
        await closeWorkspace(page);
    });

    test('OPT-012: Editor ready meets performance budget', async () => {
        await openWorkspace(page, editorWorkspace.title);
        const duration = await measureDuration(
            page,
            'workspace:editor:duration',
            'workspace:open:start',
            'workspace:editor:ready'
        );
        expect(duration).toBeLessThan(BUDGETS.editorReadyMs);
        await closeWorkspace(page);
    });

    test('OPT-012: Terminal ready meets performance budget', async () => {
        await openWorkspace(page, overviewWorkspace.title);
        await page.getByTestId('workspace-run-button').click();
        const duration = await measureDuration(
            page,
            'workspace:terminal:duration',
            'workspace:terminal:requested',
            'workspace:terminal:ready'
        );
        expect(duration).toBeLessThan(BUDGETS.terminalReadyMs);
        await closeWorkspace(page);
    });

    test('OPT-008/OPT-012: Idle CPU usage stays within budget', async () => {
        await page.waitForTimeout(2000);
        await app.evaluate(() => process.getCPUUsage());
        await page.waitForTimeout(2000);
        const cpuUsage = await app.evaluate(() => process.getCPUUsage());
        expect(cpuUsage.percentCPUUsage).toBeLessThan(BUDGETS.idleCpuPercent);
    });
});

async function createWorkspaceFixture(
    app: ElectronApplication,
    page: Page,
    title: string,
    preloadEditorState: boolean
): Promise<WorkspaceFixture> {
    const filesystemFixture = await app.evaluate(async (
        _electronContext: { app: NativeElectronApp },
        inputTitle: string
    ) => {
        const globalWithRequire = globalThis as typeof globalThis & {
            require?: NodeJS.Require;
        };
        const moduleRequire =
            process.mainModule?.require.bind(process.mainModule) ?? globalWithRequire.require;
        if (!moduleRequire) {
            throw new Error('Main-process require is unavailable in performance contract setup.');
        }
        const fs = moduleRequire('node:fs') as typeof import('node:fs');
        const os = moduleRequire('node:os') as typeof import('node:os');
        const path = moduleRequire('node:path') as typeof import('node:path');
        const safeTitle = inputTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const rootPath = path.join(
            os.tmpdir(),
            'tengra-perf-contract',
            `${safeTitle}-${Date.now()}`
        );
        const sourceDir = path.join(rootPath, 'src');
        fs.mkdirSync(sourceDir, { recursive: true });
        fs.writeFileSync(
            path.join(rootPath, 'package.json'),
            JSON.stringify({ name: safeTitle, private: true }, null, 2),
            'utf8'
        );
        fs.writeFileSync(
            path.join(sourceDir, 'index.ts'),
            'export const performanceContract = 42;\\n',
            'utf8'
        );
        return {
            rootPath,
            filePath: path.join(sourceDir, 'index.ts'),
        };
    }, title);

    const workspace = await page.evaluate(async (
        input: { title: string; rootPath: string }
    ): Promise<PerformanceWorkspaceRecord> => {
        const existing = await window.electron.db.getWorkspaces() as PerformanceWorkspaceRecord[];
        const duplicate = existing.find(item => item.path === input.rootPath);
        if (duplicate) {
            return duplicate;
        }
        return window.electron.db.createWorkspace(
            input.title,
            input.rootPath,
            'Performance contract fixture'
        ) as Promise<PerformanceWorkspaceRecord>;
    }, {
        title,
        rootPath: filesystemFixture.rootPath,
    });

    if (preloadEditorState) {
        await page.evaluate(async (
            input: { workspaceId: string; filePath: string }
        ) => {
            const storageKey = `workspace.tabs.state.v1:${input.workspaceId}`;
            const mountId = `local-${input.workspaceId}`;
            localStorage.setItem(storageKey, JSON.stringify({
                openTabs: [{
                    id: `${mountId}:${input.filePath}`,
                    mountId,
                    path: input.filePath,
                    name: 'index.ts',
                    content: 'export const performanceContract = 42;\\n',
                    savedContent: 'export const performanceContract = 42;\\n',
                    type: 'code',
                    isDirty: false,
                    isPinned: false,
                }],
                activeTabId: `${mountId}:${input.filePath}`,
            }));
        }, {
            workspaceId: workspace.id,
            filePath: filesystemFixture.filePath,
        });
    }

    return {
        id: workspace.id,
        title,
        rootPath: filesystemFixture.rootPath,
        filePath: filesystemFixture.filePath,
    };
}

function seedManagedRuntimeManifestCache(): void {
    const runtimeRoot = path.join(getAppDataRoot(), 'Tengra', 'runtime');
    const manifestsDir = path.join(runtimeRoot, 'manifests');
    const manifestPath = path.join(manifestsDir, 'runtime-manifest.json');
    const currentArch = normalizeRuntimeArch(process.arch);
    const executableSuffix = process.platform === 'win32' ? '.exe' : '';

    fs.mkdirSync(manifestsDir, { recursive: true });
    fs.writeFileSync(
        manifestPath,
        JSON.stringify(
            {
                schemaVersion: 1,
                releaseTag: 'runtime-test-contract',
                generatedAt: new Date().toISOString(),
                components: [
                    {
                        id: 'tengra-db-service',
                        displayName: 'Tengra DB Service',
                        version: 'test',
                        kind: 'service',
                        source: 'managed',
                        requirement: 'required',
                        targets: [
                            {
                                platform: process.platform,
                                arch: currentArch,
                                assetName: `tengra-db-service-${process.platform}-${currentArch}${executableSuffix}`,
                                downloadUrl: 'https://example.com/tengra-db-service.zip',
                                archiveFormat: 'raw',
                                sha256: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
                                executableRelativePath: `tengra-db-service${executableSuffix}`,
                                installSubdirectory: 'bin',
                            },
                        ],
                    },
                    {
                        id: 'cliproxy-embed',
                        displayName: 'Embedded Proxy',
                        version: 'test',
                        kind: 'service',
                        source: 'managed',
                        requirement: 'required',
                        targets: [
                            {
                                platform: process.platform,
                                arch: currentArch,
                                assetName: `cliproxy-embed-${process.platform}-${currentArch}${executableSuffix}`,
                                downloadUrl: 'https://example.com/cliproxy-embed.zip',
                                archiveFormat: 'raw',
                                sha256: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
                                executableRelativePath: `cliproxy-embed${executableSuffix}`,
                                installSubdirectory: 'bin',
                            },
                        ],
                    },
                ],
            },
            null,
            2
        ),
        'utf8'
    );
}

function getAppDataRoot(): string {
    if (process.platform === 'win32') {
        return process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming');
    }
    if (process.platform === 'darwin') {
        return path.join(os.homedir(), 'Library', 'Application Support');
    }
    return process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config');
}

function normalizeRuntimeArch(rawArch: string): 'x64' | 'arm64' {
    if (rawArch === 'arm64' || rawArch === 'aarch64') {
        return 'arm64';
    }
    return 'x64';
}

async function waitForMainRendererWindow(app: ElectronApplication): Promise<Page> {
    const fallbackWindow = await app.firstWindow();
    const deadline = Date.now() + 15000;

    while (Date.now() < deadline) {
        const windows = app.windows();
        for (const candidate of windows) {
            try {
                await candidate.waitForLoadState('domcontentloaded', { timeout: 1000 });
                const hasPerformanceBridge = await candidate.evaluate(() => {
                    return Boolean(window.electron?.performance);
                });
                if (hasPerformanceBridge) {
                    return candidate;
                }
            } catch {
                // Ignore windows that are still loading or already closing.
            }
        }

        await new Promise(resolve => {
            setTimeout(resolve, 250);
        });
    }

    return fallbackWindow;
}

async function cleanupWorkspaceFixture(page: Page, workspace?: WorkspaceFixture): Promise<void> {
    if (!workspace) {
        return;
    }

    await page.evaluate(async (workspaceId: string) => {
        const workspaces = await window.electron.db.getWorkspaces() as PerformanceWorkspaceRecord[];
        const existing = workspaces.find(item => item.id === workspaceId);
        if (existing) {
            await window.electron.db.deleteWorkspace(workspaceId);
        }
    }, workspace.id);
}

async function cleanupWorkspaceDirectory(rootPath?: string): Promise<void> {
    if (!rootPath) {
        return;
    }

    const maxAttempts = 5;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
            if (fs.existsSync(rootPath)) {
                fs.rmSync(rootPath, { recursive: true, force: true });
            }
            return;
        } catch (error) {
            const isLastAttempt = attempt === maxAttempts;
            if (isLastAttempt) {
                throw error;
            }
            await new Promise(resolve => {
                setTimeout(resolve, 250 * attempt);
            });
        }
    }
}

async function openWorkspace(page: Page, title: string): Promise<void> {
    await clearWorkspaceMarks(page);
    await navigateToWorkspaces(page);
    const workspaceCard = page.getByRole('button', { name: title });
    await workspaceCard.waitFor({ state: 'visible' });
    await workspaceCard.click();
}

async function closeWorkspace(page: Page): Promise<void> {
    await page.getByTestId('workspace-back-button').click();
    await page.waitForSelector('body', { state: 'visible' });
}

async function clearWorkspaceMarks(page: Page): Promise<void> {
    await page.evaluate(() => {
        window.__TENGRA_PERFORMANCE__?.clear('workspace:');
    });
}

async function measureDuration(
    page: Page,
    measureName: string,
    startMark: string,
    endMark: string
): Promise<number> {
    await waitForPerformanceMark(page, startMark);
    await waitForPerformanceMark(page, endMark);

    return page.evaluate(
        (
            { localMeasureName, localStartMark, localEndMark }: {
                localMeasureName: string;
                localStartMark: string;
                localEndMark: string;
            }
        ) => {
            return (
                window.__TENGRA_PERFORMANCE__?.measure(
                    localMeasureName,
                    localStartMark,
                    localEndMark
                ) ?? 0
            );
        },
        {
            localMeasureName: measureName,
            localStartMark: startMark,
            localEndMark: endMark,
        }
    );
}

async function waitForPerformanceMark(page: Page, markName: string): Promise<void> {
    await expect
        .poll(async () => {
            const report = await page.evaluate(() => {
                return window.__TENGRA_PERFORMANCE__?.getReport() as TengraPerformanceReport;
            });
            return report?.marks.some(mark => mark.name === markName) ?? false;
        })
        .toBe(true);
}

async function navigateToWorkspaces(page: Page): Promise<void> {
    const sidebar = page.getByTestId('sidebar');
    await expect(sidebar).toBeVisible();
    const workspacesButton = sidebar.getByRole('button', { name: WORKSPACE_NAVIGATION_LABEL }).first();
    await expect(workspacesButton).toBeVisible();
    await workspacesButton.click();

    await expect
        .poll(async () => {
            const currentTitle = await page
                .locator('header h1')
                .first()
                .textContent();
            return currentTitle?.trim() ?? '';
        })
        .not.toMatch(SETTINGS_NAVIGATION_LABEL);
}
