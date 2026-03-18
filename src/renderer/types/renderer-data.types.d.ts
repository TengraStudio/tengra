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
