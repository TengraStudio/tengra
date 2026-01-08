export interface AgentDefinition {
    id: string
    name: string
    description?: string
    systemPrompt: string
    tools?: string[]
    parentModel?: string
    avatar?: string // Optional for UI
}
