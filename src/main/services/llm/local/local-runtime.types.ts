/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export type LocalModelFileFormat = 'gguf' | 'safetensors' | 'ckpt' | 'unknown';

export type LocalModelRuntimeProvider = 'llama.cpp' | 'hf-native';

export interface LocalRuntimeRoute {
    baseUrl: string;
    apiKey: string;
    model: string;
    provider: string;
    runtimeProvider: LocalModelRuntimeProvider;
}

export function resolveLocalModelFileFormat(filePath: string): LocalModelFileFormat {
    const lowerPath = filePath.trim().toLowerCase();
    if (lowerPath.endsWith('.gguf')) {
        return 'gguf';
    }
    if (lowerPath.endsWith('.safetensors')) {
        return 'safetensors';
    }
    if (lowerPath.endsWith('.ckpt')) {
        return 'ckpt';
    }
    return 'unknown';
}

export function resolveRuntimeProviderForLocalModel(filePath: string): LocalModelRuntimeProvider {
    return resolveLocalModelFileFormat(filePath) === 'gguf' ? 'llama.cpp' : 'hf-native';
}
