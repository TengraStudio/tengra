/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import type { JsonObject, JsonValue } from '@shared/types/common';

declare global {
    type TypeAssertionValue =
        | object
        | string
        | number
        | boolean
        | bigint
        | symbol
        | null
        | undefined;
    type RendererDataValue = TypeAssertionValue;
    type RendererDataObject = Record<string, RendererDataValue>;
    type RendererJsonValue = JsonValue;
    type RendererJsonObject = JsonObject;
}

export {};
