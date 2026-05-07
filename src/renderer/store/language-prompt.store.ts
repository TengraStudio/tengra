/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { MarketplaceLanguage } from '@shared/types/marketplace';
import { useSyncExternalStore } from 'react';

import { localeRegistry } from '@/i18n/locale-registry.service';
import { appLogger } from '@/utils/renderer-logger';

import { marketplaceStore } from './marketplace.store';
import { getSettingsSnapshot, updateSettings } from './settings.store';

interface LanguagePromptState {
    matchingPack: MarketplaceLanguage | null;
    isVisible: boolean;
}

let state: LanguagePromptState = {
    matchingPack: null,
    isVisible: false,
};

const listeners = new Set<() => void>();

function emit() {
    listeners.forEach(l => l());
}

export const languagePromptStore = {
    getState: () => state,
    subscribe: (listener: () => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
    },
    
    checkLanguagePack: async () => {
        try {
            const systemLanguage = navigator.language; // e.g. "en-US", "tr-TR"
            const systemLocale = systemLanguage.split('-')[0].toLowerCase();
            
            const settings = getSettingsSnapshot().settings;
            if (!settings) {return;}

            // If user already changed language from default, or dismissed this locale
            const currentAppLanguage = settings.general.language;
            const dismissedPrompts = settings.general.dismissedLanguagePrompts ?? [];
            
            // Check if we should prompt
            // 1. App is not already in this language
            // 2. Not dismissed before
            if (currentAppLanguage.startsWith(systemLocale) || dismissedPrompts.includes(systemLocale)) {
                return;
            }

            // Fetch marketplace registry if not already loaded
            let registry = marketplaceStore.getState().registry;
            if (!registry) {
                await marketplaceStore.checkForUpdates();
                registry = marketplaceStore.getState().registry;
            }

            if (!registry?.languages) {return;}

            // Find all matching language packs
            const matchingPacks = registry.languages.filter(l => 
                l.locale.toLowerCase() === systemLocale || 
                l.locale.toLowerCase() === systemLanguage.toLowerCase()
            );

            if (matchingPacks.length === 0) {return;}

            // Sort by coverage (desc) then by version (desc)
            const bestPack = matchingPacks.sort((a, b) => {
                // Priority 1: Coverage
                const coverageA = a.coverage ?? 0;
                const coverageB = b.coverage ?? 0;
                if (coverageA !== coverageB) {
                    return coverageB - coverageA;
                }
                
                // Priority 2: Version (simplified semver-like comparison)
                return b.version.localeCompare(a.version, undefined, { numeric: true, sensitivity: 'base' });
            })[0];

            if (bestPack && !bestPack.installed) {
                state = { ...state, matchingPack: bestPack, isVisible: true };
                emit();
            }
        } catch (error) {
            appLogger.error('LanguagePromptStore', 'Failed to check for language pack:', error as Error);
        }
    },

    dismiss: (forever: boolean = false) => {
        if (forever && state.matchingPack) {
            const settings = getSettingsSnapshot().settings;
            if (settings) {
                const systemLocale = state.matchingPack.locale.split('-')[0].toLowerCase();
                const dismissed = [...(settings.general.dismissedLanguagePrompts ?? []), systemLocale];
                void updateSettings({
                    ...settings,
                    general: {
                        ...settings.general,
                        dismissedLanguagePrompts: Array.from(new Set(dismissed)),
                    }
                });
            }
        }
        state = { ...state, isVisible: false };
        emit();
    },

    install: async () => {
        if (!state.matchingPack) {return;}
        
        try {
            const pack = state.matchingPack;
            await window.electron.marketplace.install({
                type: 'language',
                id: pack.id,
                downloadUrl: pack.downloadUrl,
                name: pack.name,
                version: pack.version
            });
            
            // Wait a bit for filesystem to sync
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Switch language in settings
            const settings = getSettingsSnapshot().settings;
            if (settings) {
                await updateSettings({
                    ...settings,
                    general: {
                        ...settings.general,
                        language: pack.locale,
                    }
                }, true);
            }

            state = { ...state, isVisible: false };
            emit();
            
            // Refresh registry to update installed state
            await marketplaceStore.checkForUpdates();
        } catch (error) {
            appLogger.error('LanguagePromptStore', 'Failed to install language pack:', error as Error);
        }
    }
};

export function useLanguagePromptStore<T>(selector: (state: LanguagePromptState) => T): T {
    const currentState = useSyncExternalStore(languagePromptStore.subscribe, languagePromptStore.getState, languagePromptStore.getState);
    return selector(currentState);
}

