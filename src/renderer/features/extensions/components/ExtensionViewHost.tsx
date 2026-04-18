/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import path from 'path';

import { appLogger } from '@renderer/utils/renderer-logger';
import { AlertCircle, Terminal } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

import { LoadingState } from '@/components/ui/LoadingState';
import { useExtensionStore } from '@/store/extension.store';

interface ExtensionViewHostProps {
    viewId: string;
}

/**
 * Global registry for extension components
 */
const extensionComponentRegistry: Record<string, React.ComponentType<Record<string, unknown>>> = {};
const extensionBundleScriptRegistry: Record<string, HTMLScriptElement | undefined> = {};

/**
 * Register a component for an extension view
 */
export const registerExtensionComponent = (viewId: string, Component: React.ComponentType<Record<string, unknown>>) => {
    extensionComponentRegistry[viewId] = Component;
};

/**
 * Host component for extension views.
 * Loads extension's UI components dynamically.
 */
export const ExtensionViewHost: React.FC<ExtensionViewHostProps> = ({ viewId }) => {
    const extensions = useExtensionStore(s => s.extensions);
    const [Component, setComponent] = useState<React.ComponentType<Record<string, unknown>> | null>(() => extensionComponentRegistry[viewId] || null);
    const [loading, setLoading] = useState(!extensionComponentRegistry[viewId]);
    const [error, setError] = useState<string | null>(null);
    const [reloadNonce, setReloadNonce] = useState(0);
    const lastLoadedSignatureRef = useRef<string>('');
    const lastLoadedNonceRef = useRef<number>(-1);

    const activeExtension = extensions.find(ext => 
        ext.status === 'active' && 
        ext.manifest.contributes?.views?.some(v => v.id === viewId)
    );

    useEffect(() => {
        if (!window.electron || typeof window.electron.on !== 'function') {
            return;
        }
        const activeExtensionId = activeExtension?.manifest.id;
        const removeListener = window.electron.on('extension:state-changed', (_event, payload: unknown) => {
            if (
                typeof payload === 'object'
                && payload !== null
                && !Array.isArray(payload)
                && typeof (payload as Record<string, unknown>).extensionId === 'string'
            ) {
                const extensionId = (payload as Record<string, unknown>).extensionId as string;
                if (activeExtensionId && extensionId !== activeExtensionId) {
                    return;
                }
            }
            setReloadNonce(prev => prev + 1);
        });

        return () => {
            if (typeof removeListener === 'function') {
                removeListener();
            }
        };
    }, [activeExtension?.manifest.id]);

    useEffect(() => {
        if (!activeExtension) {
            setError(`Extension view "${viewId}" not found or extension not active.`);
            setLoading(false);
            return;
        }

        const viewSignature = [
            activeExtension.manifest.id,
            activeExtension.extensionPath,
            activeExtension.uiBundleStamp ?? activeExtension.manifest.version,
            activeExtension.manifest.ui ?? '',
        ].join(':');
        const shouldReloadBundle = lastLoadedSignatureRef.current !== viewSignature || lastLoadedNonceRef.current !== reloadNonce;

        const loadView = async () => {
            if (extensionComponentRegistry[viewId] && !shouldReloadBundle) {
                setError(null);
                setComponent(() => extensionComponentRegistry[viewId]);
                lastLoadedSignatureRef.current = viewSignature;
                lastLoadedNonceRef.current = reloadNonce;
                setLoading(false);
                return;
            }

            const { ui } = activeExtension.manifest;
            if (!ui) {
                setError(null);
                lastLoadedSignatureRef.current = viewSignature;
                lastLoadedNonceRef.current = reloadNonce;
                setLoading(false);
                return;
            }

            setLoading(true);
            setError(null);
            try {
                if (shouldReloadBundle) {
                    delete extensionComponentRegistry[viewId];
                    extensionBundleScriptRegistry[viewId]?.remove();
                    delete extensionBundleScriptRegistry[viewId];
                    setComponent(null);
                }

                // Construct safe-file URL for the UI bundle
                const scriptPath = activeExtension.extensionPath.endsWith(path.sep) 
                    ? `${activeExtension.extensionPath}${ui}` 
                    : path.join(activeExtension.extensionPath, ui);

                // Convert to safe-file protocol URL
                // On Windows, safe-file://C:/path...
                const bundleStamp = activeExtension.uiBundleStamp ?? activeExtension.manifest.version ?? '0';
                const bundleVersion = encodeURIComponent(`${bundleStamp}-${reloadNonce}`);
                const safeUrl = `safe-file://${scriptPath.replace(/\\/g, '/')}?v=${bundleVersion}`;

                appLogger.info('ExtensionViewHost', `Loading UI bundle for ${activeExtension.manifest.id}: ${safeUrl}`);

                // Load the script
                const script = document.createElement('script');
                script.src = safeUrl;
                script.type = 'module';
                script.async = true;

                const scriptPromise = new Promise((resolve, reject) => {
                    script.onload = resolve;
                    script.onerror = () => reject(new Error(`Failed to load script: ${safeUrl}`));
                });

                extensionBundleScriptRegistry[viewId] = script;
                document.head.appendChild(script);
                await scriptPromise;

                // Poll for registration (the script should call registerExtensionComponent)
                let attempts = 0;
                const checkRegistry = setInterval(() => {
                    if (extensionComponentRegistry[viewId]) {
                        setComponent(() => extensionComponentRegistry[viewId]);
                        lastLoadedSignatureRef.current = viewSignature;
                        lastLoadedNonceRef.current = reloadNonce;
                        setLoading(false);
                        clearInterval(checkRegistry);
                    }
                    attempts++;
                    if (attempts > 50) { // 5 second timeout
                        clearInterval(checkRegistry);
                        setError(`Extension view "${viewId}" was not registered by the UI bundle.`);
                        setLoading(false);
                    }
                }, 100);
            } catch (err) {
                appLogger.error('ExtensionViewHost', `Failed to load view ${viewId}`, err as Error);
                setError(`Failed to load extension view: ${(err as Error).message}`);
                setLoading(false);
            }
        };

        void loadView();
    }, [viewId, activeExtension, reloadNonce]);

    if (loading) {
        return <LoadingState message={`Loading ${viewId}...`} />;
    }

    if (error) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-6 bg-tech-grid">
                <div className="glass-panel p-8 rounded-2xl border border-destructive/30 flex flex-col items-center gap-4 text-center max-w-md">
                    <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                        <AlertCircle className="w-8 h-8 text-destructive" />
                    </div>
                    <h2 className="typo-h2 text-foreground font-bold">Extension Error</h2>
                    <p className="typo-body text-muted-foreground">{error}</p>
                    <div className="mt-4 px-4 py-2 bg-muted/30 rounded-lg text-xs font-mono text-muted-foreground">
                        VIEW_ID: {viewId}
                    </div>
                </div>
            </div>
        );
    }

    if (!Component) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-6 bg-tech-grid bg-tech-grid-sm">
                <div className="glass-panel p-8 rounded-2xl border border-border/50 flex flex-col items-center gap-6">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                        <Terminal className="w-8 h-8 text-primary animate-pulse" />
                    </div>
                    <div className="space-y-2 text-center">
                        <h2 className="typo-h2 text-foreground font-bold tracking-tight">
                            {activeExtension?.manifest.name || viewId}
                        </h2>
                        <p className="typo-body text-muted-foreground max-w-xs">
                            This view is provided by an extension but has no renderer component registered.
                        </p>
                    </div>
                    <div className="w-full h-px bg-gradient-to-r from-transparent via-border to-transparent" />
                    <div className="flex gap-2">
                        <div className="px-3 py-1 rounded-full bg-muted/50 text-xxs font-mono text-muted-foreground border border-border/30">
                            ID: {activeExtension?.manifest.id}
                        </div>
                        <div className="px-3 py-1 rounded-full bg-success/10 text-xxs font-mono text-success border border-success/20">
                            ACTIVE
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return <Component viewId={viewId} extension={activeExtension} />;
};
