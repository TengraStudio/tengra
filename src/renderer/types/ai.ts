export interface OllamaModel {
    name: string
    size: number
    details?: {
        format: string
        family: string
        parameter_size: string
        quantization_level: string
    }
}

export type AIProvider = 'ollama' | 'llama.cpp' | 'openai' | 'anthropic' | 'claude' | 'gemini' | 'groq' | 'antigravity' | 'copilot'
