/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

declare module 'pdf-parse' {
    interface PdfParseResult {
        text: string;
        numpages: number;
        numrender: number;
        info?: Record<string, string | number | boolean | null>;
        metadata?: Record<string, string | number | boolean | null>;
        version?: string;
    }

    type PdfParseFunction = (dataBuffer: Buffer) => Promise<PdfParseResult>;

    const pdfParse: PdfParseFunction;
    export default pdfParse;
}

