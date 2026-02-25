import { randomBytes } from 'crypto';
import { createServer, IncomingMessage, Server as HttpServer, ServerResponse } from 'http';

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
import { z } from 'zod';

// AUD-SEC-031: Schema validation for API payloads
const ToolExecuteSchema = z.object({
    toolName: z.string().min(1).max(256).regex(/^[a-zA-Z0-9._-]+$/, 'Invalid toolName format'),
    args: z.record(z.string(), z.unknown()).optional()
});

const ChatMessageSchema = z.object({
    role: z.enum(['user', 'assistant', 'system', 'tool']),
    content: z.union([z.string(), z.array(z.unknown())]).optional(),
    id: z.string().optional(),
    timestamp: z.union([z.string(), z.number()]).optional(),
    images: z.array(z.string()).optional()
});

const ChatRequestSchema = z.object({
    messages: z.array(ChatMessageSchema).min(1).max(100),
    model: z.string().max(128).optional(),
    provider: z.string().max(64).optional()
});

const VisionAnalyzeSchema = z.object({
    image: z.string().min(1),
    prompt: z.string().min(1).max(32768),
    model: z.string().max(128).optional(),
    provider: z.string().max(64).optional()
});

// AUD-SEC-033: Explicit CORS allowlist
const CORS_ALLOWED_ORIGINS = new Set([
    'chrome-extension://',
    'moz-extension://',
    'http://localhost',
    'http://127.0.0.1'
]);

// AUD-SEC-036: WebSocket limits
const WS_MAX_PAYLOAD_SIZE = 10 * 1024 * 1024; // 10MB

// AUD-SEC-035: Rate limit tracking per IP+token
const ipTokenRequestCounts = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100; // per window per IP+token

/**
 * Configuration options for the API server.
 * @property port - HTTP listen port (defaults to 42069)
 * @property settingsService - Service for reading application settings
 * @property proxyProcessManager - Manager for the embedded proxy process
 * @property toolExecutor - Executor for MCP tool invocations
 * @property llmService - Service for LLM chat interactions
 * @property modelRegistry - Optional model registry for listing available models
 * @property rateLimitService - Rate limiter for API request throttling
 */
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

    /**
     * Initialize the API server.
     * Generates a session token, checks proxy status, and starts listening.
     */
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

        await this.startServer();
    }

    /** Gracefully stop the HTTP and WebSocket servers. */
    async cleanup(): Promise<void> {
        await this.stopServer();
    }

    /**
     * Start the HTTP server with WebSocket support
     */
    private async startServer(): Promise<void> {
        try {
            // Create HTTP server
            this.httpServer = createServer((req, res) => void this.handleRequest(req, res));

            // AUD-SEC-036: Create WebSocket server with max payload validation
            this.wsServer = new WebSocketServer({
                server: this.httpServer,
                maxPayload: WS_MAX_PAYLOAD_SIZE
            });
            this.setupWebSocket();

            // Start listening
            await new Promise<void>((resolve, reject) => {
                if (!this.httpServer) {
                    reject(new Error('HTTP server not initialized'));
                    return;
                }

                this.httpServer.listen(this.port, '127.0.0.1', () => {
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

        // Use WHATWG URL API instead of deprecated url.parse()
        const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
        const pathname = url.pathname;
        const method = req.method ?? 'GET';

        // Handle public/unauthenticated routes
        if (this.handlePublicRoutes(pathname, method, req, res)) {
            return;
        }

        if (!this.checkAuth(req, res)) {
            return;
        }

        // AUD-SEC-035: Per-IP + token combined rate limiting
        const clientIp = req.socket.remoteAddress?.replace('::ffff:', '') ?? 'unknown';
        const token = this.extractTokenFromRequest(req) ?? 'anonymous';
        const rateLimitKey = `${clientIp}:${token}`;

        if (!this.checkIpTokenRateLimit(rateLimitKey)) {
            appLogger.warn(this.name, `Rate limit exceeded for ${clientIp}`);
            this.sendJson(res, 429, {
                success: false,
                error: 'Too Many Requests',
                message: 'Rate limit exceeded'
            });
            return;
        }

        // SEC-009-3: API Rate Limiting (global fallback)
        if (!this.options.rateLimitService.tryAcquire('api:request')) {
            appLogger.warn(this.name, `Global API rate limit exceeded`);
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
    private handlePublicRoutes(pathname: string, method: string, req: IncomingMessage, res: ServerResponse): boolean {
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
            if (!this.isStrictLocalRequest(req)) {
                this.sendJson(res, 403, {
                    success: false,
                    error: 'Forbidden',
                    message: 'Local access required'
                });
                return true;
            }
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

    private isStrictLocalRequest(req: IncomingMessage): boolean {
        const remoteAddress = req.socket.remoteAddress?.replace('::ffff:', '') ?? '';
        if (remoteAddress !== '127.0.0.1' && remoteAddress !== '::1') {
            return false;
        }

        const hostHeader = (req.headers.host ?? '').toLowerCase();
        const host = hostHeader.split(':')[0] ?? '';
        if (host !== 'localhost' && host !== '127.0.0.1') {
            return false;
        }

        const forwardedFor = req.headers['x-forwarded-for'];
        if (typeof forwardedFor === 'string' && forwardedFor.trim().length > 0) {
            return false;
        }

        return true;
    }

    private extractTokenFromRequest(req: IncomingMessage): string | null {
        const authHeader = req.headers.authorization;
        if (authHeader?.startsWith('Bearer ')) {
            return authHeader.substring(7);
        }
        if (typeof authHeader === 'string' && authHeader.trim().length > 0) {
            return authHeader;
        }

        const headerToken = req.headers['x-api-token'];
        if (typeof headerToken === 'string' && headerToken.trim().length > 0) {
            return headerToken.trim();
        }

        try {
            const requestUrl = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
            const queryToken = requestUrl.searchParams.get('token');
            if (queryToken && queryToken.trim().length > 0) {
                return queryToken.trim();
            }
        } catch {
            return null;
        }

        return null;
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
     * AUD-SEC-033: Restrict CORS origin handling to explicit allowlist
     */
    private setCorsHeaders(req: IncomingMessage, res: ServerResponse): void {
        const origin = req.headers.origin;

        // AUD-SEC-033: Check against explicit allowlist
        if (origin) {
            const isAllowed = Array.from(CORS_ALLOWED_ORIGINS).some(allowed =>
                origin.startsWith(allowed)
            );

            if (isAllowed) {
                res.setHeader('Access-Control-Allow-Origin', origin);
            }
            // Deny all other origins by not setting the header
        }

        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    /**
     * AUD-SEC-032: Add strict Content-Security-Policy headers on API responses
     */
    private sendJson(res: ServerResponse, status: number, data: JsonObject): void {
        res.writeHead(status, {
            'Content-Type': 'application/json',
            'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY'
        });
        res.end(JSON.stringify(data));
    }

    /**
     * AUD-SEC-035: Check per-IP + token combined rate limiting
     */
    private checkIpTokenRateLimit(key: string): boolean {
        const now = Date.now();
        const record = ipTokenRequestCounts.get(key);

        if (!record || now > record.resetTime) {
            ipTokenRequestCounts.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
            return true;
        }

        if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
            return false;
        }

        record.count++;
        return true;
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
     * AUD-SEC-031: Added schema validation
     */
    private async handleToolExecute(req: IncomingMessage, res: ServerResponse): Promise<void> {
        try {
            const body = await this.readBody(req);

            // AUD-SEC-031: Schema validation
            const parseResult = ToolExecuteSchema.safeParse(body);
            if (!parseResult.success) {
                this.sendJson(res, 400, {
                    success: false,
                    error: 'Invalid request body',
                    details: parseResult.error.issues.map(i => ({ path: i.path.join('.'), message: i.message }))
                });
                return;
            }

            const { toolName, args } = parseResult.data;

            appLogger.info(this.name, `Executing tool: ${toolName}`);

            // Convert Record<string, unknown> to JsonObject
            const jsonArgs: JsonObject = {};
            if (args) {
                for (const [key, value] of Object.entries(args)) {
                    if (value !== undefined) {
                        jsonArgs[key] = value as JsonValue;
                    }
                }
            }

            const result = await this.options.toolExecutor.execute(toolName, jsonArgs);

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
     * AUD-SEC-031: Added schema validation
     */
    private async handleChatMessage(req: IncomingMessage, res: ServerResponse): Promise<void> {
        try {
            const body = await this.readBody(req);

            // AUD-SEC-031: Schema validation
            const parseResult = ChatRequestSchema.safeParse(body);
            if (!parseResult.success) {
                this.sendJson(res, 400, {
                    success: false,
                    error: 'Invalid request body',
                    details: parseResult.error.issues.map(i => ({ path: i.path.join('.'), message: i.message }))
                });
                return;
            }

            const { messages, model, provider } = parseResult.data;

            const selectedModel = model ?? 'gpt-4o';
            const detectedProvider = this.detectProvider(selectedModel, provider);
            appLogger.info(this.name, `Chat request: model=${selectedModel}, provider=${detectedProvider}`);

            const parsedMessages = this.parseMessages(messages as JsonValue[]);
            const response = await this.options.llmService.chat(parsedMessages, selectedModel, undefined, detectedProvider);

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
     * AUD-SEC-031: Added schema validation
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

            // AUD-SEC-031: Schema validation
            const parseResult = ChatRequestSchema.safeParse(body);
            if (!parseResult.success) {
                clearTimeout(timeoutId);
                this.sendJson(res, 400, {
                    success: false,
                    error: 'Invalid request body',
                    details: parseResult.error.issues.map(i => ({ path: i.path.join('.'), message: i.message }))
                });
                return;
            }

            const { messages, model, provider } = parseResult.data;

            const selectedModel = model ?? 'gpt-4o';
            const detectedProvider = this.detectProvider(selectedModel, provider);
            appLogger.info(this.name, `Streaming chat: model=${selectedModel}, provider=${detectedProvider}`);

            // Set headers for SSE
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
            });

            const parsedMessages = this.parseMessages(messages as JsonValue[]);
            // Start streaming
            const stream = this.options.llmService.chatStream(
                parsedMessages,
                selectedModel,
                undefined,
                detectedProvider
            );

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

        this.wsServer.on('connection', (ws, req) => {
            const requestToken = this.extractTokenFromRequest(req);
            if (!requestToken || requestToken !== this.apiToken || !this.isStrictLocalRequest(req)) {
                ws.close(1008, 'Unauthorized');
                return;
            }
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
                    message: 'Connected to Tengra API server'
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
     * Get current API token for this session.
     * @returns The hex-encoded session token
     */
    getApiToken(): string {
        return this.apiToken;
    }

    /**
     * Handle vision analysis (screenshot + AI vision model)
     * AUD-SEC-031: Added schema validation
     */
    private async handleVisionAnalyze(req: IncomingMessage, res: ServerResponse): Promise<void> {
        try {
            const bodyData = await this.readBody(req);

            // AUD-SEC-031: Schema validation
            const parseResult = VisionAnalyzeSchema.safeParse(bodyData);
            if (!parseResult.success) {
                this.sendJson(res, 400, {
                    error: 'Bad Request',
                    details: parseResult.error.issues.map(i => ({ path: i.path.join('.'), message: i.message }))
                });
                return;
            }

            const {
                image,
                prompt,
                model = 'gpt-4o',
                provider
            } = parseResult.data;

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
        const normalizedProvider = provider?.trim().toLowerCase();
        if (normalizedProvider) {
            if (normalizedProvider === 'claude') { return 'anthropic'; }
            return normalizedProvider;
        }

        const normalizedModel = model.trim().toLowerCase();
        if (normalizedModel.includes('codex') || normalizedModel.startsWith('gpt-5') || normalizedModel.startsWith('o1') || normalizedModel.startsWith('o3')) { return 'codex'; }
        if (normalizedModel.startsWith('antigravity/')) { return 'antigravity'; }
        if (normalizedModel.startsWith('claude-') || normalizedModel.startsWith('anthropic/')) { return 'anthropic'; }
        if (normalizedModel.startsWith('gemini-') || normalizedModel.startsWith('google/')) { return 'google'; }
        if (normalizedModel.startsWith('ollama/')) { return 'ollama'; }
        if (normalizedModel.startsWith('gpt-')) { return 'openai'; }
        return 'openai'; // default
    }

    /**
     * Get the port the server is listening on.
     * @returns The port number
     */
    getPort(): number {
        return this.port;
    }

    /**
     * Check if the server is currently running.
     * @returns True if both HTTP and WebSocket servers are active
     */
    isRunning(): boolean {
        return this.httpServer !== null && this.wsServer !== null;
    }

    /**
     * Validate chat message array structure.
     * @param messages - Array of JSON message objects to validate
     * @throws Error if any message has invalid structure or role
     */
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

    /**
     * Parse raw JSON message objects into typed Message instances.
     * @param messages - Array of raw JSON objects
     * @returns Array of parsed Message objects
     */
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

