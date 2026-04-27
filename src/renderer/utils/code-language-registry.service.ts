/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import type { MarketplaceCodeLanguagePack } from '@shared/types/marketplace';

import { codeLanguageIpc } from '@/utils/code-language-ipc.util';
import { clearRuntimeLanguageContributions, registerRuntimeLanguageContributions } from '@/utils/language-map';
import { appLogger } from '@/utils/renderer-logger';

type Listener = () => void;

export class CodeLanguageRegistryService {
    private runtimePacks = new Map<string, MarketplaceCodeLanguagePack>();
    private listeners = new Set<Listener>();
    private isLoaded = false;

    constructor() {
        if (window.electron?.ipcRenderer) {
            window.electron.ipcRenderer.on('code-language:runtime:updated', () => {
                void this.reloadCodeLanguagePacks();
            });
        }
    }

    async loadCodeLanguagePacks(): Promise<void> {
        try {
            const packs = await codeLanguageIpc.getAllCodeLanguagePacks();
            this.runtimePacks.clear();
            for (const pack of packs) {
                this.runtimePacks.set(pack.id, pack);
            }
            registerRuntimeLanguageContributions(packs);
            this.isLoaded = true;
            this.emit();
        } catch (error) {
            appLogger.error('CodeLanguageRegistry', 'Failed to load code language packs', error as Error);
            this.runtimePacks.clear();
            clearRuntimeLanguageContributions();
            this.isLoaded = true;
            this.emit();
        }
    }

    async reloadCodeLanguagePacks(): Promise<void> {
        this.isLoaded = false;
        await this.loadCodeLanguagePacks();
    }

    getCodeLanguagePack(id: string): MarketplaceCodeLanguagePack | undefined {
        return this.runtimePacks.get(id);
    }

    getAllCodeLanguagePacks(): MarketplaceCodeLanguagePack[] {
        return Array.from(this.runtimePacks.values());
    }

    isLoadedSnapshot = (): number => {
        return this.runtimePacks.size + (this.isLoaded ? 1_000_000 : 0);
    };

    subscribe = (listener: Listener): (() => void) => {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    };

    private emit(): void {
        for (const listener of this.listeners) {
            listener();
        }
    }
}

export const codeLanguageRegistry = new CodeLanguageRegistryService();
