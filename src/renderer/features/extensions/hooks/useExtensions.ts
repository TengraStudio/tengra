/**
 * Extension Management Hook
 * MKT-DEV-01: Extension SDK/templates/CLI
 */

import {
    ExtensionDevOptions,
    ExtensionManifest,
    ExtensionProfileData,
    ExtensionPublishOptions,
    ExtensionPublishResult,
    ExtensionStatus,
    ExtensionTestOptions,
    ExtensionTestResult,
} from '@shared/types/extension';
import { useCallback, useEffect, useState } from 'react';

/** Extension info for display */
interface ExtensionInfo {
    manifest: ExtensionManifest;
    status: ExtensionStatus;
}

/** Hook state */
interface UseExtensionsState {
    extensions: ExtensionInfo[];
    loading: boolean;
    error: string | null;
}

/** Hook return type */
interface UseExtensionsReturn extends UseExtensionsState {
    refresh: () => Promise<void>;
    install: (extensionPath: string) => Promise<{ success: boolean; extensionId?: string; error?: string }>;
    uninstall: (extensionId: string) => Promise<{ success: boolean; error?: string }>;
    activate: (extensionId: string) => Promise<{ success: boolean; error?: string }>;
    deactivate: (extensionId: string) => Promise<{ success: boolean; error?: string }>;
    startDev: (options: ExtensionDevOptions) => Promise<{ success: boolean; error?: string }>;
    stopDev: (extensionId: string) => Promise<{ success: boolean; error?: string }>;
    reload: (extensionId: string) => Promise<{ success: boolean; error?: string }>;
    runTests: (options: ExtensionTestOptions) => Promise<ExtensionTestResult>;
    publish: (options: ExtensionPublishOptions) => Promise<ExtensionPublishResult>;
    getProfile: (extensionId: string) => Promise<{ success: boolean; profile?: ExtensionProfileData }>;
}

function useExtensionState() {
    const [state, setState] = useState<UseExtensionsState>({
        extensions: [],
        loading: false,
        error: null,
    });

    const refresh = useCallback(async (): Promise<void> => {
        setState((prev) => ({ ...prev, loading: true, error: null }));

        try {
            const result = await window.electron.extension?.getAll();
            if (result?.success) {
                setState({
                    extensions: result.extensions,
                    loading: false,
                    error: null,
                });
            } else {
                setState({
                    extensions: [],
                    loading: false,
                    error: 'Failed to fetch extensions',
                });
            }
        } catch (error) {
            setState({
                extensions: [],
                loading: false,
                error: (error as Error).message,
            });
        }
    }, []);

    useEffect(() => {
        let mounted = true;

        async function loadExtensions() {
            if (!mounted) { return; }
            setState((prev) => ({ ...prev, loading: true, error: null }));

            try {
                const result = await window.electron.extension?.getAll();
                if (!mounted) { return; }
                if (result?.success) {
                    setState({
                        extensions: result.extensions,
                        loading: false,
                        error: null,
                    });
                } else {
                    setState({
                        extensions: [],
                        loading: false,
                        error: 'Failed to fetch extensions',
                    });
                }
            } catch (error) {
                if (!mounted) { return; }
                setState({
                    extensions: [],
                    loading: false,
                    error: (error as Error).message,
                });
            }
        }

        void loadExtensions();

        return () => {
            mounted = false;
        };
    }, []);

    return { state, refresh };
}

function useExtensionActions(refresh: () => Promise<void>) {
    /** Install an extension */
    const install = useCallback(async (extensionPath: string): Promise<{ success: boolean; extensionId?: string; error?: string }> => {
        try {
            const result = await window.electron.extension?.install(extensionPath);
            if (result?.success) {
                await refresh();
            }
            return result ?? { success: false, error: 'Extension API not available' };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    }, [refresh]);

    /** Uninstall an extension */
    const uninstall = useCallback(async (extensionId: string): Promise<{ success: boolean; error?: string }> => {
        try {
            const result = await window.electron.extension?.uninstall(extensionId);
            if (result?.success) {
                await refresh();
            }
            return result ?? { success: false, error: 'Extension API not available' };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    }, [refresh]);

    /** Activate an extension */
    const activate = useCallback(async (extensionId: string): Promise<{ success: boolean; error?: string }> => {
        try {
            const result = await window.electron.extension?.activate(extensionId);
            if (result?.success) {
                await refresh();
            }
            return result ?? { success: false, error: 'Extension API not available' };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    }, [refresh]);

    /** Deactivate an extension */
    const deactivate = useCallback(async (extensionId: string): Promise<{ success: boolean; error?: string }> => {
        try {
            const result = await window.electron.extension?.deactivate(extensionId);
            if (result?.success) {
                await refresh();
            }
            return result ?? { success: false, error: 'Extension API not available' };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    }, [refresh]);

    return { install, uninstall, activate, deactivate };
}

function useExtensionDev(refresh: () => Promise<void>) {
    /** Start development server */
    const startDev = useCallback(async (options: ExtensionDevOptions): Promise<{ success: boolean; error?: string }> => {
        try {
            const result = await window.electron.extension?.devStart(options);
            if (result?.success) {
                await refresh();
            }
            return result ?? { success: false, error: 'Extension API not available' };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    }, [refresh]);

    /** Stop development server */
    const stopDev = useCallback(async (extensionId: string): Promise<{ success: boolean; error?: string }> => {
        try {
            const result = await window.electron.extension?.devStop(extensionId);
            if (result?.success) {
                await refresh();
            }
            return result ?? { success: false, error: 'Extension API not available' };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    }, [refresh]);

    /** Reload extension */
    const reload = useCallback(async (extensionId: string): Promise<{ success: boolean; error?: string }> => {
        try {
            const result = await window.electron.extension?.devReload(extensionId);
            if (result?.success) {
                await refresh();
            }
            return result ?? { success: false, error: 'Extension API not available' };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    }, [refresh]);

    return { startDev, stopDev, reload };
}

function useExtensionTools() {
    /** Run tests */
    const runTests = useCallback(async (options: ExtensionTestOptions): Promise<ExtensionTestResult> => {
        try {
            const result = await window.electron.extension?.test(options);
            return result ?? { success: false, passed: 0, failed: 0, skipped: 0, duration: 0 };
        } catch {
            return { success: false, passed: 0, failed: 0, skipped: 0, duration: 0 };
        }
    }, []);

    /** Publish extension */
    const publish = useCallback(async (options: ExtensionPublishOptions): Promise<ExtensionPublishResult> => {
        try {
            const result = await window.electron.extension?.publish(options);
            return result ?? { success: false, extensionId: '', version: '' };
        } catch {
            return { success: false, extensionId: '', version: '' };
        }
    }, []);

    /** Get profile data */
    const getProfile = useCallback(async (extensionId: string): Promise<{ success: boolean; profile?: ExtensionProfileData }> => {
        try {
            const result = await window.electron.extension?.getProfile(extensionId);
            return result ?? { success: false };
        } catch {
            return { success: false };
        }
    }, []);

    return { runTests, publish, getProfile };
}

/**
 * Hook for managing extensions
 */
export function useExtensions(): UseExtensionsReturn {
    const { state, refresh } = useExtensionState();
    const { install, uninstall, activate, deactivate } = useExtensionActions(refresh);
    const { startDev, stopDev, reload } = useExtensionDev(refresh);
    const { runTests, publish, getProfile } = useExtensionTools();

    return {
        ...state,
        refresh,
        install,
        uninstall,
        activate,
        deactivate,
        startDev,
        stopDev,
        reload,
        runTests,
        publish,
        getProfile,
    };
}
