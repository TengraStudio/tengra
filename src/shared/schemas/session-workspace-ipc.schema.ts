/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { z } from 'zod';

export const sessionCanvasPointSchema = z.object({
    x: z.number(),
    y: z.number(),
});

export const sessionCanvasNodeRecordSchema = z.object({
    id: z.string().min(1),
    type: z.string().min(1),
    position: sessionCanvasPointSchema,
    data: z.record(z.string(), z.any()),
});

export const sessionCanvasEdgeRecordSchema = z.object({
    id: z.string().min(1),
    source: z.string().min(1),
    target: z.string().min(1),
    sourceHandle: z.string().optional(),
    targetHandle: z.string().optional(),
});

