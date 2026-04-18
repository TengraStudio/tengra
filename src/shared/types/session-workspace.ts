/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

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
