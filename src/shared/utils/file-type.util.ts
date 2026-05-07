/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */


/**
 * Detects the MIME type of a file based on its binary signature (magic numbers).
 * This is more reliable than extension or browser-provided MIME type for security.
 */
export async function detectFileType(file: Blob): Promise<string | null> {
    const arr = (new Uint8Array(await file.slice(0, 12).arrayBuffer()));

    // Check for common image signatures
    const header = Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();

    if (header.startsWith('89504E470D0A1A0A')) { return 'image/png'; }
    if (header.startsWith('FFD8FF')) { return 'image/jpeg'; } // Start of Instance (SOI)
    if (header.startsWith('47494638')) { return 'image/gif'; } // GIF87a or GIF89a
    if (header.startsWith('424D')) { return 'image/bmp'; }
    if (header.startsWith('25504446')) { return 'application/pdf'; } // %PDF
    if (header.startsWith('52494646') && header.slice(16, 24) === '57454250') { return 'image/webp'; } // RIFF....WEBP

    // Quicktime / MP4 variants (ftyp box usually at offset 4)
    // 00 00 00 18 66 74 79 70 6D 70 34 32 -> ....ftypmp42
    // Signatures for video containers are complex, simplified check:
    if (header.slice(8).startsWith('66747970')) { // ftyp
        return 'video/mp4'; // Generic fallback for ftyp
    }

    // Zip based formats (Office, Jar, Zip)
    if (header.startsWith('504B0304')) { return 'application/zip'; }

    return null;
}

/**
 * Validates if the file content matches the declared extension.
 */
export async function validateFileSignature(file: File): Promise<boolean> {
    const detected = await detectFileType(file);
    if (!detected) {
        // If unknown signature, assume valid for text files or unhandled binaries
        // Text files have no reliable signature (except BOM)
        return true;
    }

    // Allow mismatches if the detected type is compatible (e.g. strict image/jpeg vs provided image/jpg)
    // Or if the browser type matches the detected type.
    const provided = file.type.toLowerCase();

    // Allow image/jpeg for .jpg .jpeg
    if (detected === 'image/jpeg' && (provided === 'image/jpeg' || provided === 'image/jpg')) {return true;}

    // Strict equality check
    return detected === provided;
}

