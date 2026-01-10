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
