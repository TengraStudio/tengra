/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { ipc } from '@main/core/ipc-decorators';
import { appLogger } from '@main/logging/logger';
import { BaseService } from '@main/services/base.service';
import { SettingsService } from '@main/services/system/settings.service';
import { serializeToIpc } from '@main/utils/ipc-serializer.util';
import { KEY_ROTATION_CHANNELS } from '@shared/constants/ipc-channels';
import { RuntimeValue } from '@shared/types/common';

export class KeyRotationService extends BaseService {
    private keyStates: Map<string, { keys: string[], currentIndex: number }> = new Map();

    constructor(private settingsService: SettingsService) {
        super('KeyRotationService');
        this.settingsService.getSettings(); // Suppress unused error
    }

    private validateProvider(provider: RuntimeValue): string {
        if (!provider || typeof provider !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(provider) || provider.length > 64) {
            throw new Error('Invalid provider name');
        }
        return provider.trim();
    }

    @ipc(KEY_ROTATION_CHANNELS.GET_CURRENT_KEY)
    async getCurrentKeyIpc(providerRaw: RuntimeValue): Promise<RuntimeValue> {
        const provider = this.validateProvider(providerRaw);
        const key = this.getCurrentKey(provider);
        return serializeToIpc(key);
    }

    @ipc(KEY_ROTATION_CHANNELS.ROTATE)
    async rotateKeyIpc(providerRaw: RuntimeValue): Promise<RuntimeValue> {
        const provider = this.validateProvider(providerRaw);
        const success = this.rotateKey(provider);
        const currentKey = this.getCurrentKey(provider);
        return serializeToIpc({ success, currentKey });
    }

    @ipc(KEY_ROTATION_CHANNELS.INITIALIZE)
    async initializeProviderKeysIpc(providerRaw: RuntimeValue, keyStringRaw: RuntimeValue): Promise<RuntimeValue> {
        const provider = this.validateProvider(providerRaw);
        if (typeof keyStringRaw !== 'string' || keyStringRaw.length > 4096) {
            throw new Error('Invalid key string');
        }
        this.initializeProviderKeys(provider, keyStringRaw.trim());
        const currentKey = this.getCurrentKey(provider);
        return serializeToIpc({ success: true, currentKey });
    }

    @ipc(KEY_ROTATION_CHANNELS.GET_STATUS)
    async getStatusIpc(providerRaw: RuntimeValue): Promise<RuntimeValue> {
        let safeProvider = '';
        try {
            safeProvider = this.validateProvider(providerRaw);
        } catch {
            return serializeToIpc({ provider: '', hasKey: false, currentKey: null });
        }

        const key = this.getCurrentKey(safeProvider);
        const maskedKey = key ? (key.length > 8 ? `${key.substring(0, 8)}...` : key) : null;
        
        return serializeToIpc({
            provider: safeProvider,
            hasKey: key !== null,
            currentKey: maskedKey
        });
    }

    /**
     * Initializes keys for a provider from settings.
     * Supports comma-separated keys in the settings string.
     */
    initializeProviderKeys(provider: string, keyString: string) {
        if (!keyString) { return; }

        const keys = keyString.split(',').map(k => k.trim()).filter(k => k.length > 0);
        if (keys.length > 0) {
            this.keyStates.set(provider, { keys, currentIndex: 0 });
            if (keys.length > 1) {
                appLogger.info('KeyRotation', `Initialized ${keys.length} keys for ${provider}`);
            }
        }
    }

    /**
     * Gets the current active key for a provider.
     */
    getCurrentKey(provider: string): string | null {
        const state = this.keyStates.get(provider);
        if (!state || state.keys.length === 0) { return null; }
        return state.keys[state.currentIndex];
    }

    /**
     * Rotates to the next available key for the provider.
     * Returns true if rotation was successful (i.e., there was another key to switch to).
     */
    rotateKey(provider: string): boolean {
        const state = this.keyStates.get(provider);
        if (!state || state.keys.length <= 1) {
            appLogger.warn('KeyRotation', `Cannot rotate key for ${provider}: No alternative keys available.`);
            return false;
        }

        const prevIndex = state.currentIndex;
        state.currentIndex = (state.currentIndex + 1) % state.keys.length;

        appLogger.warn('KeyRotation', `Rotating key for ${provider} (Index ${prevIndex} -> ${state.currentIndex})`);
        return true;
    }
}

