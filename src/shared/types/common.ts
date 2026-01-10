export type JsonValue = string | number | boolean | null | JsonObject | JsonArray;
export interface JsonObject { [key: string]: JsonValue | undefined }
export type JsonArray = JsonValue[];

// IpcValue is essentially the same as JsonValue, as IPC args must be serializable
export type IpcValue = JsonValue | undefined;

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

export type CatchError = Error | ErrorMessageLike | AppError | JsonValue | undefined;

export interface AuthStatus {
    authenticated?: boolean;
    files?: Array<{ provider: string }>;
    [key: string]: IpcValue;
}

export interface FileSearchResult {
    file: string;
    line: number;
    text: string;
}
