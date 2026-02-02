// import { Request, Response, Router } from 'express';
//
// import { appLogger } from '@main/logging/logger';
// import { LLMService } from '@main/services/llm/llm.service';
// import { ToolExecutor } from '@main/tools/tool-executor';
// import { JsonObject } from '@shared/types/common';
// import { Message } from '@shared/types/chat';
// import { getErrorMessage } from '@shared/utils/error.util';
//
// // import { ApiAuthMiddleware } from './api-auth.middleware';
//
// export interface ApiRouterOptions {
//     toolExecutor: ToolExecutor;
//     llmService: LLMService;
//     // authMiddleware: ApiAuthMiddleware;
// }
//
// /**
//  * API Router for browser extension endpoints
//  */
// export class ApiRouter {
//     // private router: Router;
//
//     constructor(private options: ApiRouterOptions) {
//         // this.router = Router();
//         // this.setupRoutes();
//     }
//
//     /**
//      * Setup all API routes
//      */
//     /*
//     private setupRoutes(): void {
//         // Apply auth middleware to all /api routes
//         this.router.use(this.options.authMiddleware.authenticate);
//
//         // Tools endpoints
//         this.router.get('/tools/list', this.handleListTools.bind(this));
//         this.router.post('/tools/execute', this.handleExecuteTool.bind(this));
//
//         // Chat endpoints
//         this.router.post('/chat/message', this.handleChatMessage.bind(this));
//         this.router.post('/chat/stream', this.handleChatStream.bind(this));
//
//         // Browser control endpoints (will be used by extension)
//         this.router.post('/browser/navigate', this.handleBrowserNavigate.bind(this));
//         this.router.post('/browser/click', this.handleBrowserClick.bind(this));
//         this.router.post('/browser/fill', this.handleBrowserFill.bind(this));
//         this.router.post('/browser/extract', this.handleBrowserExtract.bind(this));
//     }
//     */
//
//     /**
//      * Get the Express router
//      */
//     /*
//     getRouter(): Router {
//         return this.router;
//     }
//     */
//
//     // ... methods commented out ...
// }
