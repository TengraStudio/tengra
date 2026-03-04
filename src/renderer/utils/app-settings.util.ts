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
