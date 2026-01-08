/**
 * Configuration Validator
 * Validates application settings with type safety
 */

export type ValidationResult = {
    valid: boolean
    errors: ValidationError[]
    warnings: ValidationWarning[]
}

export interface ValidationError {
    path: string
    message: string
    value?: any
}

export interface ValidationWarning {
    path: string
    message: string
    suggestion?: string
}

type Validator<T> = (value: T, path: string) => ValidationError[]

// Built-in validators
export const validators = {
    required: <T>(value: T, path: string): ValidationError[] => {
        if (value === undefined || value === null || value === '') {
            return [{ path, message: 'Value is required' }]
        }
        return []
    },

    string: (value: any, path: string): ValidationError[] => {
        if (value !== undefined && typeof value !== 'string') {
            return [{ path, message: 'Must be a string', value }]
        }
        return []
    },

    number: (value: any, path: string): ValidationError[] => {
        if (value !== undefined && typeof value !== 'number') {
            return [{ path, message: 'Must be a number', value }]
        }
        return []
    },

    boolean: (value: any, path: string): ValidationError[] => {
        if (value !== undefined && typeof value !== 'boolean') {
            return [{ path, message: 'Must be a boolean', value }]
        }
        return []
    },

    url: (value: any, path: string): ValidationError[] => {
        if (value === undefined || value === '') return []
        try {
            new URL(value)
            return []
        } catch {
            return [{ path, message: 'Must be a valid URL', value }]
        }
    },

    port: (value: any, path: string): ValidationError[] => {
        if (value === undefined) return []
        if (typeof value !== 'number' || value < 1 || value > 65535) {
            return [{ path, message: 'Must be a valid port (1-65535)', value }]
        }
        return []
    },

    email: (value: any, path: string): ValidationError[] => {
        if (value === undefined || value === '') return []
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(value)) {
            return [{ path, message: 'Must be a valid email address', value }]
        }
        return []
    },

    min: (minValue: number) => (value: any, path: string): ValidationError[] => {
        if (value !== undefined && typeof value === 'number' && value < minValue) {
            return [{ path, message: `Must be at least ${minValue}`, value }]
        }
        return []
    },

    max: (maxValue: number) => (value: any, path: string): ValidationError[] => {
        if (value !== undefined && typeof value === 'number' && value > maxValue) {
            return [{ path, message: `Must be at most ${maxValue}`, value }]
        }
        return []
    },

    oneOf: <T>(allowedValues: T[]) => (value: any, path: string): ValidationError[] => {
        if (value !== undefined && !allowedValues.includes(value)) {
            return [{ path, message: `Must be one of: ${allowedValues.join(', ')}`, value }]
        }
        return []
    },

    pattern: (regex: RegExp, message: string) => (value: any, path: string): ValidationError[] => {
        if (value !== undefined && typeof value === 'string' && !regex.test(value)) {
            return [{ path, message, value }]
        }
        return []
    }
}

// Schema definition
export interface SchemaField {
    type: 'string' | 'number' | 'boolean' | 'object' | 'array'
    required?: boolean
    validators?: Validator<any>[]
    default?: any
    children?: Record<string, SchemaField>
}

export type Schema = Record<string, SchemaField>

/**
 * Validate a config object against a schema
 */
export function validateConfig(config: any, schema: Schema, basePath = ''): ValidationResult {
    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []

    for (const [key, field] of Object.entries(schema)) {
        const path = basePath ? `${basePath}.${key}` : key
        const value = config?.[key]

        // Check required
        if (field.required && (value === undefined || value === null)) {
            errors.push({ path, message: 'This field is required' })
            continue
        }

        // Type validation
        if (value !== undefined) {
            const typeErrors = validateType(value, field.type, path)
            errors.push(...typeErrors)
        }

        // Custom validators
        if (field.validators && value !== undefined) {
            for (const validator of field.validators) {
                errors.push(...validator(value, path))
            }
        }

        // Nested object validation
        if (field.type === 'object' && field.children && value) {
            const nestedResult = validateConfig(value, field.children, path)
            errors.push(...nestedResult.errors)
            warnings.push(...nestedResult.warnings)
        }
    }

    // Check for unknown keys
    if (config && typeof config === 'object') {
        for (const key of Object.keys(config)) {
            const path = basePath ? `${basePath}.${key}` : key
            if (!schema[key]) {
                warnings.push({
                    path,
                    message: 'Unknown configuration key',
                    suggestion: 'This key may be deprecated or misspelled'
                })
            }
        }
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings
    }
}

function validateType(value: any, type: string, path: string): ValidationError[] {
    switch (type) {
        case 'string':
            return validators.string(value, path)
        case 'number':
            return validators.number(value, path)
        case 'boolean':
            return validators.boolean(value, path)
        case 'object':
            if (typeof value !== 'object' || Array.isArray(value)) {
                return [{ path, message: 'Must be an object', value }]
            }
            return []
        case 'array':
            if (!Array.isArray(value)) {
                return [{ path, message: 'Must be an array', value }]
            }
            return []
        default:
            return []
    }
}

/**
 * Apply defaults from schema to config
 */
export function applyDefaults(config: any, schema: Schema): any {
    const result = { ...config }

    for (const [key, field] of Object.entries(schema)) {
        if (result[key] === undefined && field.default !== undefined) {
            result[key] = field.default
        }

        if (field.type === 'object' && field.children) {
            result[key] = applyDefaults(result[key] || {}, field.children)
        }
    }

    return result
}

// Pre-defined settings schema
export const settingsSchema: Schema = {
    proxy: {
        type: 'object',
        children: {
            enabled: { type: 'boolean', default: true },
            port: { type: 'number', validators: [validators.port], default: 8317 },
            key: { type: 'string' }
        }
    },
    ollama: {
        type: 'object',
        children: {
            url: { type: 'string', validators: [validators.url], default: 'http://127.0.0.1:11434' }
        }
    },
    gemini: {
        type: 'object',
        children: {
            apiKey: { type: 'string' }
        }
    },
    openai: {
        type: 'object',
        children: {
            apiKey: { type: 'string' },
            baseUrl: { type: 'string', validators: [validators.url] }
        }
    },
    anthropic: {
        type: 'object',
        children: {
            apiKey: { type: 'string' }
        }
    },
    theme: {
        type: 'string',
        validators: [validators.oneOf(['dark', 'light', 'system'])],
        default: 'dark'
    },
    autoUpdate: {
        type: 'boolean',
        default: true
    }
}
