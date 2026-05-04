/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export interface TemplateVariable {
    name: string
    type: 'string' | 'number' | 'boolean' | 'select' | 'textarea'
    description?: string
    defaultValue?: string | number | boolean
    required?: boolean
    options?: string[] // For 'select' type
    placeholder?: string
}

export interface PromptTemplate {
    id: string
    name: string
    description?: string
    template: string
    variables: TemplateVariable[]
    category?: string
    tags?: string[]
    createdAt: number
    updatedAt: number
}
