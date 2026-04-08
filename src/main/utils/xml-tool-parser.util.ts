import { ToolCall } from '@shared/types/chat';
import { generateSecureId } from '@shared/utils/id.util';

/**
 * Utility for parsing XML-style tool calls often used by Copilot/Codex models.
 * Format: <function_calls><invoke name="NAME"><parameter name="ARG">VALUE</parameter></invoke></function_calls>
 */
export class XmlToolParser {
    private static readonly XML_TOOL_REGEX = /<function_calls>([\s\S]*?)<\/function_calls>/g;
    private static readonly INVOKE_REGEX = /<invoke\s+name="([^"]+)">([\s\S]*?)<\/invoke>/g;
    private static readonly PARAMETER_REGEX = /<parameter\s+name="([^"]+)">([\s\S]*?)<\/parameter>/g;

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
            if (shouldTrim) {
                cleanedText = cleanedText.trim();
            }
        }

        // 5. Also look for orphaned <invoke> blocks if they aren't wrapped in <function_calls>
        // (Some models are inconsistent)
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

        return { toolCalls, cleanedText: shouldTrim ? cleanedText.trim() : cleanedText };
    }

    /**
     * Checks if a string contains any potential XML tool calling fragments.
     * Useful for determining if we should buffer content during streaming.
     */
    static hasPotentialXmlCall(text: string): boolean {
        // Full tags (already closed, will be handled by parse())
        if (text.includes('</function_calls>') || text.includes('</invoke>')) {
            return true;
        }

        // Open tags that are not yet closed
        if (text.includes('<function_calls') || text.includes('<invoke')) {
            return true;
        }

        // Partial tags at the very end
        const lastOpen = text.lastIndexOf('<');
        if (lastOpen !== -1) {
            const fragment = text.slice(lastOpen);
            if ('<function_calls>'.startsWith(fragment) || '<invoke'.startsWith(fragment)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Strips any incomplete XML tags from the end of a string to prevent visual flickering.
     */
    static stripIncompleteTags(text: string): { content: string; buffered: string } {
        // If we have an open <invoke or <function_calls without a closing tag, buffer everything from that point
        const openInvoke = text.lastIndexOf('<invoke');
        const openFunc = text.lastIndexOf('<function_calls');
        
        const lastStart = Math.max(openInvoke, openFunc);
        
        if (lastStart !== -1) {
            // Check if it's closed AFTER this start
            const isFullyClosed = 
                (openInvoke !== -1 && text.includes('</invoke>', lastStart)) ||
                (openFunc !== -1 && text.includes('</function_calls>', lastStart));

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
            if ('<function_calls>'.startsWith(fragment) || '<invoke'.startsWith(fragment)) {
                return {
                    content: text.slice(0, lastBracket),
                    buffered: fragment
                };
            }
        }

        return { content: text, buffered: '' };
    }
}
