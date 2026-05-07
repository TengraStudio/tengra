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

/**
 * Utility for parsing XML-style tool calls often used by Copilot/Codex models.
 * Format: <function_calls><invoke name="NAME"><parameter name="ARG">VALUE</parameter></invoke></function_calls>
 */
export class XmlToolParser {
    private static readonly XML_TOOL_REGEX = /<function_calls>([\s\S]*?)<\/function_calls>/g;
    private static readonly INVOKE_REGEX = /<invoke\s+name="([^"]+)">([\s\S]*?)<\/invoke>/g;
    private static readonly PARAMETER_REGEX = /<parameter\s+name="([^"]+)">([\s\S]*?)<\/parameter>/g;
    private static readonly TOOL_TAG_REGEX = /<tool\s+name="([^"]+)">([\s\S]*?)<\/tool>/g;

    private static parseToolTagInvocation(
        name: string,
        rawArgs: string,
        idPrefix: string
    ): ToolCall | null {
        const toolName = name.trim();
        const trimmedArgs = rawArgs.trim();
        if (toolName.length === 0 || trimmedArgs.length === 0) {
            return null;
        }
        try {
            const parsed = JSON.parse(trimmedArgs) as unknown;
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                return null;
            }
            return {
                id: `${idPrefix}-${generateSecureId()}`,
                type: 'function',
                function: {
                    name: toolName,
                    arguments: JSON.stringify(parsed)
                }
            };
        } catch {
            return null;
        }
    }

    /**
     * Extracts tool calls from a block of text and returns the cleaned text.
     */
    static parse(text: string, options: { trim?: boolean } = {}): { toolCalls: ToolCall[]; cleanedText: string } {
        const toolCalls: ToolCall[] = [];
        let cleanedText = text;
        const shouldTrim = options.trim ?? true;

        // 1. Find all <function_calls> blocks
        const blocks = [...text.matchAll(this.XML_TOOL_REGEX)];
        
        for (const block of blocks) {
            const blockFullContent = block[0];
            const innerContent = block[1];
            
            // 2. Find all <invoke> tags within the block
            const invocations = [...innerContent.matchAll(this.INVOKE_REGEX)];
            
            for (const invocation of invocations) {
                const name = invocation[1];
                const paramsContent = invocation[2];
                const args: Record<string, string> = {};
                
                // 3. Find all <parameter> tags within the invocation
                const parameters = [...paramsContent.matchAll(this.PARAMETER_REGEX)];
                for (const param of parameters) {
                    const paramName = param[1];
                    const paramValue = param[2].trim();
                    args[paramName] = paramValue;
                }
                
                toolCalls.push({
                    id: `xml-${generateSecureId()}`,
                    type: 'function',
                    function: {
                        name,
                        arguments: JSON.stringify(args)
                    }
                });
            }
            
            // 4. Remove the XML block from the cleaned text
            cleanedText = cleanedText.replace(blockFullContent, '');
        }

        // 5. Also look for orphaned <invoke> blocks if they aren't wrapped in <function_calls>
        const orphanedInvocations = [...cleanedText.matchAll(this.INVOKE_REGEX)];
        for (const invocation of orphanedInvocations) {
            const blockFullContent = invocation[0];
            const name = invocation[1];
            const paramsContent = invocation[2];
            const args: Record<string, string> = {};
            
            const parameters = [...paramsContent.matchAll(this.PARAMETER_REGEX)];
            for (const param of parameters) {
                const paramName = param[1];
                const paramValue = param[2].trim();
                args[paramName] = paramValue;
            }
            
            toolCalls.push({
                id: `xml-orphan-${generateSecureId()}`,
                type: 'function',
                function: {
                    name,
                    arguments: JSON.stringify(args)
                }
            });
            cleanedText = cleanedText.replace(blockFullContent, '');
        }

        // 6. Parse strict fallback tags: <tool name="tool_name">{...json args...}</tool>
        const toolTags = [...cleanedText.matchAll(this.TOOL_TAG_REGEX)];
        for (const match of toolTags) {
            const full = match[0];
            const name = match[1];
            const rawArgs = match[2];
            const toolCall = this.parseToolTagInvocation(name, rawArgs, 'xml-tool');
            if (toolCall) {
                toolCalls.push(toolCall);
            }
            cleanedText = cleanedText.replace(full, '');
        }

        return { toolCalls, cleanedText: shouldTrim ? cleanedText.trim() : cleanedText };
    }

    /**
     * Checks if a string contains any potential UNCLOSED XML tool calling fragments.
     */
    static hasPotentialXmlCall(text: string): boolean {
        // Look for the last '<'
        const lastOpen = text.lastIndexOf('<');
        if (lastOpen === -1) {
            return false;
        }

        // Check if there's a corresponding '>' after it
        const lastClose = text.indexOf('>', lastOpen);
        if (lastClose !== -1) {
            // If it's a known closing tag of a tool call, we should return true so parse() can handle it
            const closedTag = text.slice(lastOpen, lastClose + 1);
            if (closedTag === '</function_calls>' || closedTag === '</invoke>') {
                return true;
            }
            if (closedTag === '</tool>') {
                return true;
            }
            
            // Otherwise, check if we are currently inside an open block
            const openInvocations = (text.match(/<invoke/g) || []).length;
            const closeInvocations = (text.match(/<\/invoke>/g) || []).length;
            if (openInvocations > closeInvocations) {
                return true;
            }

            const openBlocks = (text.match(/<function_calls/g) || []).length;
            const closeBlocks = (text.match(/<\/function_calls>/g) || []).length;
            if (openBlocks > closeBlocks) {
                return true;
            }
            const openToolTags = (text.match(/<tool\s+name="/g) || []).length;
            const closeToolTags = (text.match(/<\/tool>/g) || []).length;
            if (openToolTags > closeToolTags) {
                return true;
            }

            return false;
        }

        // It's unclosed. Check if it looks like a tool tag starting.
        const fragment = text.slice(lastOpen);
        if ('<function_calls>'.startsWith(fragment) || '<invoke'.startsWith(fragment) || '<tool'.startsWith(fragment)) {
            return true;
        }

        return false;
    }

    /**
     * Strips any incomplete XML tags from the end of a string to prevent visual flickering.
     */
    static stripIncompleteTags(text: string): { content: string; buffered: string } {
        // If we have an open <invoke or <function_calls or <tool> without a closing tag, buffer everything from that point
        const openInvoke = text.lastIndexOf('<invoke');
        const openFunc = text.lastIndexOf('<function_calls');
        const openTool = text.lastIndexOf('<tool');
        
        const lastStart = Math.max(openInvoke, openFunc, openTool);
        
        if (lastStart !== -1) {
            // Check if it's closed AFTER this start
            const isFullyClosed = 
                (openInvoke !== -1 && text.includes('</invoke>', lastStart)) ||
                (openFunc !== -1 && text.includes('</function_calls>', lastStart)) ||
                (openTool !== -1 && text.includes('</tool>', lastStart));

            if (!isFullyClosed) {
                return {
                    content: text.slice(0, lastStart),
                    buffered: text.slice(lastStart)
                };
            }
        }

        // Handle the very end "<" case
        const lastBracket = text.lastIndexOf('<');
        if (lastBracket !== -1 && lastBracket > lastStart) {
            const fragment = text.slice(lastBracket);
            if ('<function_calls>'.startsWith(fragment) || '<invoke'.startsWith(fragment) || '<tool'.startsWith(fragment)) {
                return {
                    content: text.slice(0, lastBracket),
                    buffered: fragment
                };
            }
        }

        return { content: text, buffered: '' };
    }
}

