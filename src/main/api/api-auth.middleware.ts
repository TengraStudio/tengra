// import { NextFunction, Request, Response } from 'express';
//
// import { appLogger } from '@main/logging/logger';
//
// /**
//  * Authentication middleware for API endpoints
//  */
// export class ApiAuthMiddleware {
//     constructor(private validToken: string) {}
//
//     /**
//      * Middleware function to validate API token
//      */
//     authenticate = (req: any, res: any, next: any): void => {
//         const authHeader = req.headers.authorization;
//
//         if (!authHeader) {
//             appLogger.warn('ApiAuth', 'Request without Authorization header');
//             res.status(401).json({
//                 error: 'Unauthorized',
//                 message: 'Missing Authorization header'
//             });
//             return;
//         }
//
//         // Support both "Bearer TOKEN" and just "TOKEN"
//         const token = authHeader.startsWith('Bearer ')
//             ? authHeader.substring(7)
//             : authHeader;
//
//         if (token !== this.validToken) {
//             appLogger.warn('ApiAuth', 'Invalid API token provided');
//             res.status(401).json({
//                 error: 'Unauthorized',
//                 message: 'Invalid API token'
//             });
//             return;
//         }
//
//         // Token is valid, proceed
//         next();
//     };
//
//     /**
//      * Update the valid token
//      */
//     updateToken(newToken: string): void {
//         this.validToken = newToken;
//     }
// }
