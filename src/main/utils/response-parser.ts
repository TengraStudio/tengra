/**
 * Utility functions for parsing AI responses from various providers
 */

/**
 * Parse content from various API response formats
 * Handles:
 * - Standard OpenAI format: {choices: [{message: {content: '...'}}]}
 * - Copilot new format: {content: [{type: 'output_text', text: '...'}], type: 'message'}
 * - Direct string content
 * - Nested JSON in strings
 * 
 * @param response - The response object or string to parse
 * @returns The extracted text content
 */
export function parseAIResponseContent(response: any): string {
    if (!response) return ''

    // If response is a string, try to parse it
    if (typeof response === 'string') {
        const trimmed = response.trim()
        // Check if it looks like JSON
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            try {
                const parsed = JSON.parse(trimmed)
                return parseAIResponseContent(parsed)
            } catch {
                // Not valid JSON, return as-is
                return trimmed
            }
        }
        return trimmed
    }

    // Handle array (multiple response parts)
    if (Array.isArray(response)) {
        return response
            .map(item => parseAIResponseContent(item))
            .filter(Boolean)
            .join('')
    }

    // Handle new Copilot format: {content: [{type: 'output_text', text: '...'}], type: 'message'}
    if (response.type === 'message' && Array.isArray(response.content)) {
        return response.content
            .filter((item: any) => item.type === 'output_text' || item.text)
            .map((item: any) => item.text || '')
            .join('')
    }

    // Handle content array directly
    if (Array.isArray(response.content)) {
        return response.content
            .filter((item: any) => item.type === 'output_text' || item.text || typeof item === 'string')
            .map((item: any) => {
                if (typeof item === 'string') return item
                return item.text || ''
            })
            .join('')
    }

    // Handle standard OpenAI format
    if (response.choices && response.choices[0]?.message?.content) {
        return response.choices[0].message.content
    }

    // Handle message wrapper
    if (response.message?.content) {
        return parseAIResponseContent(response.message.content)
    }

    // Handle output_text directly
    if (response.output_text) {
        return response.output_text
    }

    // Handle direct content string
    if (typeof response.content === 'string') {
        // Check if content is nested JSON
        const c = response.content.trim()
        if (c.startsWith('{') && c.includes('"content"')) {
            try {
                const parsed = JSON.parse(c)
                return parseAIResponseContent(parsed)
            } catch { }
        }
        return c
    }

    // Handle output array (some response formats)
    if (Array.isArray(response.output)) {
        return response.output
            .filter((item: any) => item.type === 'output_text' || item.text)
            .map((item: any) => item.text || '')
            .join('')
    }

    // Fallback - if nothing else works
    if (response.text) return response.text
    if (response.role === 'assistant' && !response.content) return ''

    return ''
}

/**
 * Check if a response contains a reasoning block
 */
export function extractReasoning(response: any): { reasoning: string | null, content: string } {
    const content = parseAIResponseContent(response)

    // Check for reasoning in the response object
    if (response?.reasoning) {
        return { reasoning: response.reasoning, content }
    }

    // Check for summary field (some formats use this for reasoning)
    if (response?.summary && Array.isArray(response.summary) && response.summary.length > 0) {
        return { reasoning: response.summary.join('\n'), content }
    }

    return { reasoning: null, content }
}
