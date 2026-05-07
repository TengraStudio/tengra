/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { ToolCall } from '@shared/types/ai/chat';
import { generateSecureId } from '@shared/utils/data/id.util';

type UnsafeValue = ReturnType<typeof JSON.parse>;

/**
 * Utility for parsing JSON-style tool calls that models might output as raw text.
 * Handles various formats like:
 * - { "name": "...", "arguments": { ... } }
 * - { "tool": "...", "parameters": { ... } }
 * - { "mcp__...": { ... } }
 * - { "mcp__..." } (Incomplete/Short format)
 */
export class JsonToolParser {
    // Regex to find potential JSON objects in text. 
    // We look for objects that contain "mcp__" or "name"/"arguments" or "tool"/"parameters"
    private static readonly JSON_OBJECT_REGEX = /\{[\s\S]*?\}/g;

    /**
     * Extracts tool calls from a block of text and returns the cleaned text.
     */
    static parse(text: string, options: { trim?: boolean } = {}): { toolCalls: ToolCall[]; cleanedText: string } {
        const toolCalls: ToolCall[] = [];
        let cleanedText = text;
        const shouldTrim = options.trim ?? true;

        const matches = [...text.matchAll(this.JSON_OBJECT_REGEX)];
        
        for (const match of matches) {
            const rawJson = match[0];
            const parsed = this.tryParseToolCall(rawJson);
            
            if (parsed) {
                toolCalls.push(parsed);
                cleanedText = cleanedText.replace(rawJson, '');
            }
        }

        return { 
            toolCalls, 
            cleanedText: shouldTrim ? cleanedText.trim() : cleanedText 
        };
    }

    /**
     * Tries to parse a string as a tool call.
     */
    private static tryParseToolCall(raw: string): ToolCall | null {
        try {
            // First, try direct JSON parse if it looks like an object
            let obj: UnsafeValue;
            try {
                obj = JSON.parse(raw);
            } catch {
                // If it's something like { "mcp__tool" }, it's invalid JSON.
                // Try to "fix" it if it looks like a single-key object without value.
                const shortMatch = raw.match(/^\{\s*"([^"]+)"\s*\}$/);
                if (shortMatch) {
                    obj = { name: shortMatch[1], arguments: {} };
                } else {
                    return null;
                }
            }

            // Case 1: { "name": "...", "arguments": { ... } }
            if (obj.name && (obj.arguments !== undefined || obj.parameters !== undefined)) {
                return {
                    id: `json-${generateSecureId()}`,
                    type: 'function',
                    function: {
                        name: obj.name,
                        arguments: typeof obj.arguments === 'string' 
                            ? obj.arguments 
                            : JSON.stringify(obj.arguments || obj.parameters || {})
                    }
                };
            }

            // Case 2: { "tool": "...", "parameters": { ... } }
            if (obj.tool && (obj.parameters !== undefined || obj.arguments !== undefined)) {
                return {
                    id: `json-${generateSecureId()}`,
                    type: 'function',
                    function: {
                        name: obj.tool,
                        arguments: typeof obj.parameters === 'string'
                            ? obj.parameters
                            : JSON.stringify(obj.parameters || obj.arguments || {})
                    }
                };
            }

            // Case 3: { "mcp__...": { ... } }
            const keys = Object.keys(obj);
            if (keys.length === 1 && keys[0].startsWith('mcp__')) {
                const name = keys[0];
                const args = obj[name];
                return {
                    id: `json-mcp-${generateSecureId()}`,
                    type: 'function',
                    function: {
                        name,
                        arguments: typeof args === 'string' ? args : JSON.stringify(args || {})
                    }
                };
            }

            // Case 4: Custom "name" property from Case 0 (fixed invalid JSON)
            if (obj.name && typeof obj.name === 'string' && obj.name.startsWith('mcp__')) {
                 return {
                    id: `json-fix-${generateSecureId()}`,
                    type: 'function',
                    function: {
                        name: obj.name,
                        arguments: '{}'
                    }
                };
            }

            return null;
        } catch {
            return null;
        }
    }

    /**
     * Checks if a string contains any potential UNCLOSED JSON tool calling fragments.
     */
    static hasPotentialJsonCall(text: string): boolean {
        // Find the last unclosed '{'
        const lastOpen = text.lastIndexOf('{');
        if (lastOpen === -1) {
            return false;
        }

        // Check if there's a corresponding '}' after it
        const lastClose = text.indexOf('}', lastOpen);
        if (lastClose !== -1) {
            // It's closed. If it was a tool call, parse() would have handled it.
            // If it wasn't, we shouldn't buffer it anymore.
            return false;
        }

        // It's unclosed. Check if the fragment looks like a tool call starting.
        const fragment = text.slice(lastOpen);
        
        // If it's very short, it might be the start of anything. Buffer it just in case.
        if (fragment.length < 10) {
            return true;
        }

        if (
            fragment.includes('"mcp__') || 
            fragment.includes('"name"') || 
            fragment.includes('"tool"') ||
            fragment.includes('"function"')
        ) {
            return true;
        }
        return false;
    }

    /**
     * Attempts to extract a tool name and ID from a partial JSON string.
     * Useful for providing early UI feedback before the JSON is complete.
     */
    static tryExtractPartialName(buffer: string): { name: string; id?: string } | null {
        if (!buffer || buffer.length < 5) {
            return null;
        }

        const nameMatch = buffer.match(/"name"\s*:\s*"([^"]*)"/);
        const idMatch = buffer.match(/"id"\s*:\s*"([^"]*)"/);

        if (nameMatch && nameMatch[1]) {
            return {
                name: nameMatch[1],
                id: idMatch && idMatch[1] ? idMatch[1] : undefined
            };
        }

        return null;
    }
}

