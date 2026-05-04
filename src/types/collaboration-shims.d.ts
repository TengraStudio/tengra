declare module 'lib0/observable' {
    type UnsafeValue = ReturnType<typeof JSON.parse>;

    export class Observable<TEventName extends string = string> {
        on(eventName: TEventName, fn: (...args: UnsafeValue[]) => void): void;
        off(eventName: TEventName, fn: (...args: UnsafeValue[]) => void): void;
        emit(eventName: TEventName, args: UnsafeValue[]): void;
        destroy(): void;
    }
}

declare module 'yjs' {
    export class Doc {
        on(eventName: 'update', fn: (update: Uint8Array, origin: unknown) => void): void;
    }

    export function applyUpdate(doc: Doc, update: Uint8Array, origin?: unknown): void;
}

declare module 'y-protocols/awareness' {
    import type { Doc } from 'yjs';

    export interface AwarenessUserState {
        name: string;
        color: string;
    }

    export interface AwarenessClientState {
        user?: AwarenessUserState;
        [key: string]: unknown;
    }

    export class Awareness {
        constructor(doc: Doc);
        getStates(): Map<number, AwarenessClientState>;
        setLocalStateField(field: string, value: unknown): void;
        on(eventName: 'change', fn: () => void): void;
        on(
            eventName: 'update',
            fn: (
                payload: { added: number[]; updated: number[]; removed: number[] },
                origin: unknown
            ) => void
        ): void;
        off(eventName: 'change', fn: () => void): void;
    }

    export function applyAwarenessUpdate(awareness: Awareness, update: Uint8Array, origin?: unknown): void;
    export function encodeAwarenessUpdate(awareness: Awareness, clients: number[]): Uint8Array;
}
