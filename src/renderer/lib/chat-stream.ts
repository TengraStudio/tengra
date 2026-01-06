export async function* chatStream(
    messages: any[],
    model: string,
    tools: any[] = [],
    provider?: string,
    options?: any
) {
    let currentResolver: ((value: any) => void) | null = null;
    let queue: any[] = [];
    let isDone = false;
    let error: any = null;

    // Type for the listener callback
    const listener = (chunk: any) => {
        if (isDone) return;
        queue.push(chunk);
        if (currentResolver) {
            currentResolver(null); // Signal that data is available
            currentResolver = null;
        }
    };

    // Subscribe using the exposed bridge method
    window.electron.onStreamChunk(listener);

    // Start the stream via IPC
    window.electron.chatStream(messages, model, tools, provider, options)
        .then(() => {
            isDone = true;
            if (currentResolver) currentResolver(null);
        })
        .catch(err => {
            error = err;
            isDone = true;
            if (currentResolver) currentResolver(null);
        });

    try {
        while (true) {
            while (queue.length > 0) {
                const chunk = queue.shift();

                // Inspect chunk structure and normalize keys
                if (chunk && typeof chunk === 'object') {
                    if (chunk.content) yield { type: 'content', content: chunk.content };
                    if (chunk.reasoning) yield { type: 'reasoning', content: chunk.reasoning };
                    if (chunk.images) yield { type: 'images', images: chunk.images };
                    if (chunk.type === 'tool_calls') yield chunk; // Pass through tool calls if structure matches
                    if (chunk.type === 'error') yield chunk;
                }
            }

            if (isDone) {
                if (error) throw error;
                break;
            }

            // Wait for next chunk or completion
            await new Promise(resolve => currentResolver = resolve);
        }
    } finally {
        // Clean up listener
        window.electron.removeStreamChunkListener(listener);
    }
}
