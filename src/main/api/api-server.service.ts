import { randomBytes } from 'crypto';
import { createServer, IncomingMessage, Server as HttpServer, ServerResponse } from 'http';
import { parse } from 'url';

import { appLogger } from '@main/logging/logger';
import { BaseService } from '@main/services/base.service';
import { LLMService } from '@main/services/llm/llm.service';
import { ProxyProcessManager } from '@main/services/proxy/proxy-process.service';
import { SettingsService } from '@main/services/system/settings.service';
import { ToolExecutor } from '@main/tools/tool-executor';
import { Message, MessageContentPart } from '@shared/types/chat';
import { JsonObject, JsonValue } from '@shared/types/common';
import { getErrorMessage } from '@shared/utils/error.util';
import { WebSocketServer } from 'ws';

export interface ApiServerOptions {
    port?: number;
    settingsService: SettingsService;
    proxyProcessManager: ProxyProcessManager;
    toolExecutor: ToolExecutor;
    llmService: LLMService;
    modelRegistry?: import('@main/services/llm/model-registry.service').ModelRegistryService;
    rateLimitService: import('@main/services/security/rate-limit.service').RateLimitService;
}

/**
 * REST API server for browser extension communication.
 * Exposes tools and AI chat capabilities via HTTP/WebSocket.
 */
export class ApiServerService extends BaseService {
    private httpServer: HttpServer | null = null;
    private wsServer: WebSocketServer | null = null;
    private port: number;
    private apiToken: string = '';

    constructor(private options: ApiServerOptions) {
        super('ApiServerService');
        this.port = options.port ?? 42069;
    }

    async initialize(): Promise<void> {
        appLogger.info(this.name, 'Initializing API server...');

        // Check if proxy is running
        const proxyStatus = this.options.proxyProcessManager.getStatus();
        if (!proxyStatus.running) {
            appLogger.warn(
                this.name,
                'Proxy is not running. Browser extension requires proxy to be active.'
            );
            // We'll still start the API server, but extension will show warning
        }

        // Generate API token for this session
        this.apiToken = this.generateApiToken();
        appLogger.info(this.name, `Generated API token for extension auth`);

        await this.startServer();
    }

    async cleanup(): Promise<void> {
        appLogger.info(this.name, 'Cleaning up API server...');
        await this.stopServer();
    }

    /**
     * Start the HTTP server with WebSocket support
     */
    private async startServer(): Promise<void> {
        try {
            // Create HTTP server
            this.httpServer = createServer((req, res) => void this.handleRequest(req, res));

            // Create WebSocket server
            this.wsServer = new WebSocketServer({ server: this.httpServer });
            this.setupWebSocket();

            // Start listening
            await new Promise<void>((resolve, reject) => {
                if (!this.httpServer) {
                    reject(new Error('HTTP server not initialized'));
                    return;
                }

                this.httpServer.listen(this.port, () => {
                    appLogger.info(
                        this.name,
                        `API server listening on http://localhost:${this.port}`
                    );
                    resolve();
                });

                this.httpServer.on('error', (error) => {
                    appLogger.error(this.name, `Server error: ${getErrorMessage(error)}`);
                    reject(error);
                });
            });
        } catch (error) {
            appLogger.error(
                this.name,
                `Failed to start API server: ${getErrorMessage(error as Error)}`
            );
            throw error;
        }
    }

    /**
     * Stop the server gracefully
     */
    private async stopServer(): Promise<void> {
        return new Promise<void>((resolve) => {
            if (this.wsServer) {
                this.wsServer.close();
                this.wsServer = null;
            }

            if (this.httpServer) {
                this.httpServer.close(() => {
                    appLogger.info(this.name, 'API server stopped');
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }

    /**
     * Handle incoming HTTP requests
     */
    private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
        // CORS headers
        this.setCorsHeaders(req, res);

        // Handle OPTIONS preflight
        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }

        const parsedUrl = parse(req.url ?? '', true);
        const pathname = parsedUrl.pathname ?? '/';
        const method = req.method ?? 'GET';

        appLogger.info(this.name, `${method} ${pathname}`);

        // Handle public/unauthenticated routes
        if (this.handlePublicRoutes(pathname, method, res)) {
            return;
        }

        if (!this.checkAuth(req, res)) {
            return;
        }

        // SEC-009-3: API Rate Limiting
        // Use auth token as key if available, otherwise IP? Actually just use a global 'api' bucket for now
        // or per-token if we had multiple. Since we generate one token per session, it's effectively per-session.
        // Let's use a shared 'api:request' bucket to protect the server generally, 
        // effectively limiting the extension's call rate.
        if (!this.options.rateLimitService.tryAcquire('api:request')) {
            appLogger.warn(this.name, `API rate limit exceeded`);
            this.sendJson(res, 429, {
                success: false,
                error: 'Too Many Requests',
                message: 'Rate limit exceeded'
            });
            return;
        }

        // Handle authenticated routes
        await this.handlePrivateRoutes(pathname, req, res);
    }

    /**
     * Handle public routes that don't require authentication
     * 
     * @openapi
     * /health:
     *   get:
     *     description: Server health check
     *     responses:
     *       200:
     *         description: Server is healthy
     * /api/proxy/status:
     *   get:
     *     description: Get status of the proxy process
     * /api/auth/token:
     *   get:
     *     description: Get the current API token (local only)
     */
    private handlePublicRoutes(pathname: string, method: string, res: ServerResponse): boolean {
        // Health check endpoint
        if (pathname === '/health' && method === 'GET') {
            this.sendJson(res, 200, {
                status: 'ok',
                timestamp: new Date().toISOString(),
                version: '1.0.0'
            });
            return true;
        }

        // Proxy status endpoint
        if (pathname === '/api/proxy/status' && method === 'GET') {
            this.handleProxyStatus(res);
            return true;
        }

        // Token endpoint
        if (pathname === '/api/auth/token' && method === 'GET') {
            this.sendJson(res, 200, {
                token: this.apiToken,
                expiresIn: 86400
            });
            return true;
        }

        return false;
    }

    /**
     * Validate request authentication
     */
    private checkAuth(req: IncomingMessage, res: ServerResponse): boolean {
        const authHeader = req.headers.authorization;
        const token = authHeader?.startsWith('Bearer ')
            ? authHeader.substring(7)
            : authHeader;

        if (token !== this.apiToken) {
            this.sendJson(res, 401, {
                success: false,
                error: 'Unauthorized',
                message: 'Invalid or missing API token'
            });
            return false;
        }

        return true;
    }

    /**
     * Handle private routes that require authentication
     * 
     * @openapi
     * /api/tools/list:
     *   get:
     *     description: List available MCP tools
     * /api/models:
     *   get:
     *     description: List available LLM models
     * /api/tools/execute:
     *   post:
     *     description: Execute a specific tool
     *     body: { toolName: string, args: object }
     * /api/chat/message:
     *   post:
     *     description: Send a chat message to LLM
     *     body: { messages: Message[], model?: string, provider?: string }
     * /api/chat/stream:
     *   post:
     *     description: Stream chat response (SSE)
     * /api/vision/analyze:
     *   post:
     *     description: Analyze image with vision model
     *     body: { image: string, prompt: string }
     */
    private async handlePrivateRoutes(pathname: string, req: IncomingMessage, res: ServerResponse): Promise<void> {
        const method = req.method ?? 'GET';

        // Route mapping for authenticated endpoints
        if (method === 'GET') {
            switch (pathname) {
                case '/api/tools/list':
                    await this.handleToolsList(res);
                    return;
                case '/api/models':
                    await this.handleGetModels(res);
                    return;
            }
        } else if (method === 'POST') {
            switch (pathname) {
                case '/api/tools/execute':
                    await this.handleToolExecute(req, res);
                    return;
                case '/api/chat/message':
                    await this.handleChatMessage(req, res);
                    return;
                case '/api/chat/stream':
                    await this.handleChatStream(req, res);
                    return;
                case '/api/vision/analyze':
                    await this.handleVisionAnalyze(req, res);
                    return;
            }
        }

        // 404 Not Found
        this.sendJson(res, 404, {
            success: false,
            error: 'Not Found',
            message: `Route ${pathname} not found`
        });
    }

    /**
     * Set CORS headers
     */
    private setCorsHeaders(req: IncomingMessage, res: ServerResponse): void {
        const origin = req.headers.origin;

        if (origin?.startsWith('chrome-extension://') || origin?.startsWith('moz-extension://')) {
            res.setHeader('Access-Control-Allow-Origin', origin);
        } else if (origin?.match(/^http:\/\/(localhost|127\.0\.0\.1)/)) {
            // Allow localhost for development
            res.setHeader('Access-Control-Allow-Origin', origin);
        }
        // Deny all other origins by not setting the header

        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    /**
     * Send JSON response
     */
    private sendJson(res: ServerResponse, status: number, data: JsonObject): void {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
    }

    /**
     * Read request body as JSON with size limit
     */
    private async readBody(req: IncomingMessage, maxSize = 2 * 1024 * 1024): Promise<JsonObject> {
        return new Promise((resolve, reject) => {
            let body = '';
            let bytesReceived = 0;

            req.on('data', (chunk) => {
                bytesReceived += chunk.length;

                // Prevent DoS via large payloads
                if (bytesReceived > maxSize) {
                    req.destroy();
                    reject(new Error(`Request body too large (max ${maxSize} bytes)`));
                    return;
                }

                body += chunk.toString();
            });
            req.on('end', () => {
                try {
                    resolve(body ? JSON.parse(body) : {});
                } catch {
                    reject(new Error('Invalid JSON body'));
                }
            });
            req.on('error', reject);
        });
    }

    /**
     * Proxy status endpoint
     */
    private handleProxyStatus(res: ServerResponse): void {
        const proxyStatus = this.options.proxyProcessManager.getStatus();
        const settings = this.options.settingsService.getSettings();

        this.sendJson(res, 200, {
            running: proxyStatus.running,
            enabled: settings.proxy?.enabled ?? false,
            port: proxyStatus.port,
            pid: proxyStatus.pid,
            url: settings.proxy?.url ?? 'http://localhost:8317/v1'
        });
    }

    /**
     * Handle tools list endpoint
     */
    private async handleToolsList(res: ServerResponse): Promise<void> {
        try {
            const tools = await this.options.toolExecutor.getToolDefinitions();
            const toolList: JsonObject[] = tools.map((tool) => ({
                name: tool.function.name,
                description: tool.function.description,
                parameters: tool.function.parameters ?? {}
            }));
            const response = {
                success: true,
                tools: toolList
            } satisfies JsonObject;
            this.sendJson(res, 200, response);
        } catch (error) {
            appLogger.error(this.name, `Failed to list tools: ${getErrorMessage(error as Error)}`);
            this.sendJson(res, 500, {
                success: false,
                error: 'Failed to list tools',
                message: getErrorMessage(error as Error)
            });
        }
    }

    /**
     * Handle tool execute endpoint
     */
    private async handleToolExecute(req: IncomingMessage, res: ServerResponse): Promise<void> {
        try {
            const body = await this.readBody(req);
            const { toolName, args } = body as {
                toolName?: string;
                args?: JsonObject;
            };

            if (!toolName) {
                this.sendJson(res, 400, {
                    success: false,
                    error: 'Missing toolName parameter'
                });
                return;
            }

            // SEC-008-2: Validate tool name format (alphanumeric, dots, hyphens, underscores only)
            if (!/^[a-zA-Z0-9._-]+$/.test(toolName)) {
                this.sendJson(res, 400, {
                    success: false,
                    error: 'Invalid toolName format. Only alphanumeric characters, dots, hyphens, and underscores allowed.'
                });
                return;
            }

            appLogger.info(this.name, `Executing tool: ${toolName}`);

            const result = await this.options.toolExecutor.execute(toolName, args ?? {});

            const responseBody = {
                success: true,
                result: this.normalizeToolResult(result)
            } satisfies JsonObject;
            this.sendJson(res, 200, responseBody);
        } catch (error) {
            appLogger.error(this.name, `Tool execution failed: ${getErrorMessage(error as Error)}`);
            this.sendJson(res, 500, {
                success: false,
                error: 'Tool execution failed',
                message: getErrorMessage(error as Error)
            });
        }
    }

    /**
     * Handle chat message endpoint
     */
    private async handleChatMessage(req: IncomingMessage, res: ServerResponse): Promise<void> {
        try {
            const body = await this.readBody(req);
            const { messages, model, provider } = body as {
                messages?: JsonValue;
                model?: string;
                provider?: string;
            };

            if (!messages || !Array.isArray(messages)) {
                this.sendJson(res, 400, {
                    success: false,
                    error: 'Missing or invalid messages parameter'
                });
                return;
            }

            // SEC-008-3: Validate message structure
            try {
                this.validateChatMessages(messages as JsonValue[]);
            } catch (error) {
                this.sendJson(res, 400, {
                    success: false,
                    error: (error as Error).message
                });
                return;
            }

            appLogger.info(this.name, `Chat request: model=${model}, provider=${provider}`);

            const parsedMessages = this.parseMessages(messages as JsonValue[]);
            const response = await this.options.llmService.chatOpenAI(parsedMessages, {
                model: model ?? 'gpt-4o',
                provider: provider ?? 'openai'
            });

            const toolCalls = this.normalizeToolCalls(response.tool_calls);
            const responseBody = {
                success: true,
                response: {
                    content: response.content ?? null,
                    tool_calls: toolCalls,
                    usage: {
                        prompt_tokens: response.promptTokens ?? 0,
                        completion_tokens: response.completionTokens ?? 0,
                        total_tokens: response.totalTokens ?? 0
                    }
                }
            } satisfies JsonObject;
            this.sendJson(res, 200, responseBody);
        } catch (error) {
            appLogger.error(this.name, `Chat request failed: ${getErrorMessage(error as Error)}`);
            this.sendJson(res, 500, {
                success: false,
                error: 'Chat request failed',
                message: getErrorMessage(error as Error)
            });
        }
    }

    /**
     * Handle chat stream endpoint
     */
    private async handleChatStream(req: IncomingMessage, res: ServerResponse): Promise<void> {
        // SEC-009-4: Add timeout for streaming
        const STREAM_TIMEOUT_MS = 300000; // 5 minutes
        const timeoutId = setTimeout(() => {
            appLogger.warn(this.name, 'Stream timeout reached, closing connection');
            res.end();
        }, STREAM_TIMEOUT_MS);

        try {
            const body = await this.readBody(req);
            const { messages, model, provider } = body as {
                messages?: JsonValue;
                model?: string;
                provider?: string;
            };

            if (!messages || !Array.isArray(messages)) {
                clearTimeout(timeoutId);
                this.sendJson(res, 400, {
                    success: false,
                    error: 'Missing or invalid messages parameter'
                });
                return;
            }

            appLogger.info(this.name, `Streaming chat: model=${model}, provider=${provider}`);

            // Set headers for SSE
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
            });

            const parsedMessages = this.parseMessages(messages as JsonValue[]);
            // Start streaming
            const stream = this.options.llmService.chatOpenAIStream(parsedMessages, {
                model: model ?? 'gpt-4o',
                provider: provider ?? 'openai'
            });

            for await (const chunk of stream) {
                res.write(`data: ${JSON.stringify(chunk)}\n\n`);
            }

            res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
            res.end();
            clearTimeout(timeoutId);
        } catch (error) {
            clearTimeout(timeoutId);
            appLogger.error(
                this.name,
                `Streaming chat failed: ${getErrorMessage(error as Error)}`
            );

            if (!res.headersSent) {
                this.sendJson(res, 500, {
                    success: false,
                    error: 'Streaming chat failed',
                    message: getErrorMessage(error as Error)
                });
            } else {
                res.write(
                    `data: ${JSON.stringify({ error: getErrorMessage(error as Error), done: true })}\n\n`
                );
                res.end();
            }
        }
    }

    /**
     * Setup WebSocket server for real-time communication
     */
    private setupWebSocket(): void {
        if (!this.wsServer) {
            return;
        }

        this.wsServer.on('connection', (ws, _req) => {
            const clientId = randomBytes(8).toString('hex');
            appLogger.info(this.name, `WebSocket client connected: ${clientId}`);

            ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    appLogger.info(
                        this.name,
                        `WebSocket message from ${clientId}: ${message.type}`
                    );

                    // Handle different message types
                    // Will be implemented when we add router
                } catch (error) {
                    appLogger.error(
                        this.name,
                        `WebSocket message error: ${getErrorMessage(error as Error)}`
                    );
                    ws.send(
                        JSON.stringify({
                            type: 'error',
                            error: 'Invalid message format'
                        })
                    );
                }
            });

            ws.on('close', () => {
                appLogger.info(this.name, `WebSocket client disconnected: ${clientId}`);
            });

            ws.on('error', (error) => {
                appLogger.error(
                    this.name,
                    `WebSocket error for ${clientId}: ${getErrorMessage(error)}`
                );
            });

            // Send welcome message
            ws.send(
                JSON.stringify({
                    type: 'connected',
                    clientId,
                    message: 'Connected to Tandem API server'
                })
            );
        });
    }

    /**
     * Generate a random API token for session
     */
    private generateApiToken(): string {
        return randomBytes(32).toString('hex');
    }

    /**
     * Get current API token
     */
    getApiToken(): string {
        return this.apiToken;
    }

    /**
     * Handle vision analysis (screenshot + AI vision model)
     */
    private async handleVisionAnalyze(req: IncomingMessage, res: ServerResponse): Promise<void> {
        try {
            const bodyData = await this.readBody(req);
            const {
                image,
                prompt,
                model = 'gpt-4o',
                provider
            } = bodyData as {
                image?: string;
                prompt?: string;
                model?: string;
                provider?: string;
            };

            if (!image || !prompt) {
                this.sendJson(res, 400, {
                    error: 'Bad Request',
                    message: 'Missing image or prompt'
                });
                return;
            }

            // Auto-detect provider if not specified
            const detectedProvider = this.detectProvider(model, provider);

            // Extract base64 from data URL if present
            const base64Image = image.includes('base64,')
                ? image.split('base64,')[1]
                : image;

            // Create vision message
            const messages: Message[] = [
                {
                    id: Date.now().toString(),
                    role: 'user',
                    content: prompt,
                    timestamp: new Date(),
                    images: [base64Image]
                }
            ];

            // Send to LLM with vision capability
            appLogger.info(this.name, `Vision analysis with ${model} (${detectedProvider})`);

            const response = await this.options.llmService.chat(
                messages,
                model,
                undefined, // tools
                detectedProvider,
                { temperature: 0.7 }
            );

            if (!response.content) {
                throw new Error('No response from vision model');
            }

            const responseBody = {
                success: true,
                content: response.content ?? null,
                model
            } satisfies JsonObject;
            this.sendJson(res, 200, responseBody);
        } catch (error) {
            appLogger.error(this.name, 'Vision analysis failed:', error as Error);
            this.sendJson(res, 500, {
                error: 'Internal Server Error',
                message: getErrorMessage(error)
            });
        }
    }

    /**
     * Get available models from model-service
     */
    private async handleGetModels(res: ServerResponse): Promise<void> {
        try {
            if (!this.options.modelRegistry) {
                appLogger.error(this.name, 'Model registry not available');
                this.sendJson(res, 503, {
                    success: false,
                    error: 'Service Unavailable',
                    message: 'Model registry service is not available'
                });
                return;
            }

            // Get models from model registry service
            const models = await this.options.modelRegistry.getAllModels();

            // If no models found, return error instead of fallback
            if (models.length === 0) {
                appLogger.warn(this.name, 'No models available from registry');
                this.sendJson(res, 200, {
                    success: false,
                    models: [],
                    message: 'No models available. Make sure model services are running.'
                });
                return;
            }

            this.sendJson(res, 200, {
                success: true,
                models: models.map((m: { id: string; name: string; provider: string; description?: string; contextWindow?: number }) => ({
                    id: m.id,
                    name: m.name,
                    provider: m.provider,
                    description: m.description,
                    contextWindow: m.contextWindow
                }))
            });
        } catch (error) {
            appLogger.error(this.name, 'Failed to get models:', error as Error);
            this.sendJson(res, 500, {
                success: false,
                error: 'Internal Server Error',
                message: getErrorMessage(error)
            });
        }
    }

    /**
     * Detect provider from model name
     */
    private detectProvider(model: string, provider?: string): string {
        if (provider) { return provider; }
        if (model.startsWith('gpt-')) { return 'openai'; }
        if (model.startsWith('claude-')) { return 'anthropic'; }
        if (model.startsWith('gemini-')) { return 'google'; }
        return 'openai'; // default
    }

    /**
     * Get server port
     */
    getPort(): number {
        return this.port;
    }

    /**
     * Check if server is running
     */
    isRunning(): boolean {
        return this.httpServer !== null && this.wsServer !== null;
    }

    private validateChatMessages(messages: JsonValue[]): void {
        for (const msg of messages) {
            if (typeof msg !== 'object' || msg === null) {
                throw new Error('Invalid message: must be an object');
            }

            const m = msg as Record<string, unknown>;

            if (!m.role || typeof m.role !== 'string') {
                throw new Error('Invalid message: missing or invalid role');
            }

            if (!['user', 'assistant', 'system', 'tool'].includes(m.role as string)) {
                throw new Error(`Invalid message role: ${m.role}`);
            }

            if (m.content !== undefined && typeof m.content !== 'string' && !Array.isArray(m.content)) {
                throw new Error('Invalid message: content must be string or array');
            }
        }
    }

    private normalizeToolResult(result: { success: boolean; result?: JsonValue; error?: string }): JsonObject {
        return {
            success: result.success,
            result: result.result ?? null,
            error: result.error
        };
    }

    private normalizeToolCalls(toolCalls?: Message['toolCalls']): JsonValue {
        if (!toolCalls) {
            return null;
        }
        return toolCalls.map((call) => ({
            id: call.id,
            type: call.type,
            function: {
                name: call.function.name,
                arguments: call.function.arguments
            }
        }));
    }

    private parseMessages(messages: JsonValue[]): Message[] {
        this.validateChatMessages(messages);
        return messages.map((raw, index) => {
            if (typeof raw !== 'object' || raw === null) {
                throw new Error('Invalid message: must be an object');
            }
            const record = raw as Record<string, JsonValue>;
            const role = String(record.role) as Message['role'];
            const content = this.normalizeMessageContent(record.content);
            const id = typeof record.id === 'string' ? record.id : `${Date.now()}-${index}`;
            const timestamp = this.parseTimestamp(record.timestamp);
            const images = Array.isArray(record.images)
                ? record.images.filter((img): img is string => typeof img === 'string')
                : undefined;

            return {
                id,
                role,
                content,
                timestamp,
                images
            };
        });
    }

    private parseTimestamp(value: JsonValue | undefined): Date {
        if (typeof value === 'string' || typeof value === 'number') {
            const parsed = new Date(value);
            if (!Number.isNaN(parsed.getTime())) {
                return parsed;
            }
        }
        return new Date();
    }

    private normalizeMessageContent(value: JsonValue | undefined): Message['content'] {
        if (typeof value === 'string') {
            return value;
        }
        if (!Array.isArray(value)) {
            return '';
        }

        const parts = value
            .filter((item): item is Record<string, JsonValue> => typeof item === 'object' && item !== null)
            .map((item): MessageContentPart | null => {
                const type = item.type;
                if (type === 'text' && typeof item.text === 'string') {
                    return { type: 'text', text: item.text };
                }
                if (type === 'image_url' && typeof item.image_url === 'object' && item.image_url !== null) {
                    const imageUrl = item.image_url as Record<string, JsonValue>;
                    const url = imageUrl.url;
                    const detail = imageUrl.detail;
                    if (typeof url === 'string') {
                        const detailValue =
                            detail === 'auto' || detail === 'low' || detail === 'high' ? detail : undefined;
                        if (detailValue) {
                            return { type: 'image_url', image_url: { url, detail: detailValue } };
                        }
                        return { type: 'image_url', image_url: { url } };
                    }
                }
                return null;
            })
            .filter((part): part is MessageContentPart => part !== null);

        return parts.length > 0 ? parts : '';
    }
}
