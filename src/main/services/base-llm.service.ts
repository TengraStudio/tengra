
export interface ChatMessage {
    role: string;
    content: string | null;
    tool_calls?: any[];
    name?: string;
    tool_call_id?: string;
}

export abstract class BaseLLMService {
    constructor() { }

    abstract chat(messages: ChatMessage[], model: string, tools?: any[]): Promise<any>;
    abstract streamChat(messages: ChatMessage[], model: string, tools?: any[]): Promise<ReadableStream<Uint8Array> | null | AsyncIterable<string>>;

    /**
     * Standardizes and filters tools for LLM consumption.
     * Ensures MCP tools and native tools are formatted flexibly for diff providers.
     */
    protected prepareTools(tools?: any[]): any[] | undefined {
        if (!tools || tools.length === 0) return undefined;

        // Common filtering logic can go here if needed
        // For now, we pass them through but ensure structure is clean
        return tools.map(tool => {
            // Ensure strict OpenAI format compatible structure
            return {
                type: tool.type || 'function',
                function: {
                    name: tool.function.name,
                    description: tool.function.description,
                    parameters: tool.function.parameters
                }
            };
        });
    }

    /**
     * Common error handling wrapper
     */
    protected handleError(error: any, context: string): never {
        console.error(`[${this.constructor.name}] ${context} Error:`, error);
        throw error; // Re-throw for caller to handle
    }
}
