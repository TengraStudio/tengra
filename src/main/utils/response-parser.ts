/**
 * Utility functions for parsing AI responses from various formats
 */

import { JsonObject, JsonValue } from '@shared/types/common'
import { safeJsonParse } from '@shared/utils/sanitize.util'

const isJsonObject = (value: JsonValue | undefined): value is JsonObject =>
    typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Parse content from various API response formats
 */
export function parseAIResponseContent(response: JsonValue | undefined): string {
    if (!response) { return '' }

    // If response is a string, try to parse it
    if (typeof response === 'string') {
        const trimmed = response.trim()
        // Check if it looks like JSON
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            const parsed = safeJsonParse<JsonValue>(trimmed, null)
            if (parsed) {
                return parseAIResponseContent(parsed)
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

    if (!isJsonObject(response)) { return '' }
    const res = response

    // Handle new Copilot format: {content: [{type: 'output_text', text: '...'}], type: 'message'}
    if (res.type === 'message' && Array.isArray(res.content)) {
        return res.content
            .filter((item) => isJsonObject(item) && (item.type === 'output_text' || item.text))
            .map((item) => (isJsonObject(item) && typeof item.text === 'string' ? item.text : ''))
            .join('')
    }

    // Handle content array directly
    if (Array.isArray(res.content)) {
        return res.content
            .filter((item) => {
                if (!item) { return false }
                if (typeof item === 'string') { return true }
                return isJsonObject(item) && (item.type === 'output_text' || item.text)
            })
            .map((item) => {
                if (typeof item === 'string') { return item }
                if (!isJsonObject(item)) { return '' }
                return typeof item.text === 'string' ? item.text : ''
            })
            .join('')
    }

    // Handle standard OpenAI format
    if (res.choices && Array.isArray(res.choices)) {
        const choice = res.choices[0]
        const message = isJsonObject(choice) ? choice.message : undefined
        if (isJsonObject(message) && typeof message.content === 'string') {
            return message.content
        }
    }

    // Handle message wrapper
    if (res.message && typeof res.message === 'object') {
        const m = isJsonObject(res.message) ? res.message : undefined
        if (m?.content !== undefined) {
            return parseAIResponseContent(m.content)
        }
    }

    // Handle output_text directly
    if (typeof res.output_text === 'string') {
        return res.output_text
    }

    // Handle direct content string
    if (typeof res.content === 'string') {
        // Check if content is nested JSON
        const c = res.content.trim()
        if (c.startsWith('{') && c.includes('"content"')) {
            const parsed = safeJsonParse(c, null)
            if (parsed) {
                return parseAIResponseContent(parsed)
            }
        }
        return c
    }

    // Handle output array (some response formats)
    if (Array.isArray(res.output)) {
        return res.output
            .filter((item) => isJsonObject(item) && (item.type === 'output_text' || item.text))
            .map((item) => (isJsonObject(item) && typeof item.text === 'string' ? item.text : ''))
            .join('')
    }

    // Fallback - if nothing else works
    if (typeof res.text === 'string') { return res.text }
    if (res.role === 'assistant' && !res.content) { return '' }

    return ''
}

/**
 * Check if a response contains a reasoning block
 */
export function extractReasoning(response: JsonValue | undefined): { reasoning: string | null, content: string } {
    const content = parseAIResponseContent(response)

    if (isJsonObject(response)) {
        const res = response

        // Check for reasoning in the response object
        if (typeof res.reasoning === 'string') {
            return { reasoning: res.reasoning, content }
        }

        // Check for summary field (some formats use this for reasoning)
        if (Array.isArray(res.summary) && res.summary.length > 0) {
            return { reasoning: res.summary.filter((item): item is string => typeof item === 'string').join('\n'), content }
        }
    }

    return { reasoning: null, content }
}
