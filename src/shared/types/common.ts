/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export type JsonValue = string | number | boolean | null | JsonObject | JsonArray;
export interface JsonObject { [key: string]: JsonValue | undefined }
export type JsonArray = JsonValue[];

// IpcValue is essentially the same as JsonValue, as IPC args must be serializable
export type IpcValue = JsonValue | undefined;

export interface IpcContractEntry<Args extends readonly IpcValue[] = readonly IpcValue[], Response = JsonValue | object | undefined> {
    args: Args;
    response: Response;
}

export type IpcContractMap = Record<string, IpcContractEntry>;

// Type for Error objects in catch blocks
export interface ErrorMessageLike {
    message?: string;
    code?: string;
}

export interface AppError {
    message: string;
    code?: string;
    details?: JsonValue;
    stack?: string;
}

export type CatchError = Error | ErrorMessageLike | AppError | JsonValue | object | undefined;

export interface AuthStatus {
    authenticated?: boolean;
    files?: Array<{ provider: string }>;
}

export interface FileSearchResult {
    file: string;
    line: number;
    text: string;
    type?: string;
    name?: string;
}

export type RuntimeValue =
    | string
    | number
    | boolean
    | bigint
    | symbol
    | void
    | null
    | undefined
    | object
    | RuntimeObject
    | RuntimeArray
    | Uint8Array;

export interface RuntimeObject {
    [key: string]: RuntimeValue;
}

export type RuntimeArray = Array<RuntimeValue>;

