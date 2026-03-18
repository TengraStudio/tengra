declare global {
    interface RuntimeRecord {
        [key: string]: RuntimeValue;
    }

    type RuntimePrimitive = string | number | boolean | bigint | symbol | null | undefined | void;
    type RuntimeValue = RuntimePrimitive | object;
}

export {};
