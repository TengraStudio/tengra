/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import type { AppSettings, JsonObject, JsonValue, ServiceResponse } from '@shared/types';

function isJsonObject(value: object | JsonValue | null | undefined): value is JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isAppSettings(
    value: AppSettings | JsonValue | ServiceResponse<AppSettings> | null | undefined
): value is AppSettings {
    if (!isJsonObject(value)) {
        return false;
    }

    const ollama = value['ollama'];
    const embeddings = value['embeddings'];
    const general = value['general'];

    return isJsonObject(ollama) && isJsonObject(embeddings) && isJsonObject(general);
}

export function unwrapSettingsResponse(response: AppSettings | ServiceResponse<AppSettings>): AppSettings | null {
    if (isAppSettings(response)) {
        return response;
    }

    const payload = response.data;
    if (!payload) {
        return null;
    }

    return isAppSettings(payload) ? payload : null;
}
