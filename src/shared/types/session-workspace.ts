import type { IpcValue } from './common';

export interface SessionCanvasNodeRecord {
    id: string;
    type: string;
    position: {
        x: number;
        y: number;
    };
    data: Record<string, IpcValue>;
}

export interface SessionCanvasEdgeRecord {
    id: string;
    source: string;
    target: string;
    sourceHandle?: string;
    targetHandle?: string;
}
