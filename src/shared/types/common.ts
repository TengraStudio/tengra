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
    | null
    | undefined
    | RuntimeObject
    | RuntimeArray
    | Record<string, unknown>
    | Uint8Array
    | unknown[];

export interface RuntimeObject {
    [key: string]: RuntimeValue;
}

export type RuntimeArray = Array<RuntimeValue>;
