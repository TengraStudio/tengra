/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { AppError } from './base-error';

/**
 * Error thrown during network operations.
 * Use for HTTP failures, timeouts, DNS resolution issues, or connectivity problems.
 */
export class NetworkError extends AppError {
  /** HTTP status code, if applicable */
  public readonly statusCode?: number;
  /** The URL that was being accessed */
  public readonly url?: string;

  /**
   * Creates a new NetworkError.
   * @param message - Human-readable error description
   * @param code - Machine-readable error code
   * @param options - Optional cause, context, statusCode, and url
   */
  constructor(
    message: string,
    code: string = 'NETWORK_ERROR',
    options?: {
      cause?: Error
      context?: Record<string, RuntimeValue>
      statusCode?: number
      url?: string
    }
  ) {
    super(message, code, { cause: options?.cause, context: options?.context });
    this.statusCode = options?.statusCode;
    this.url = options?.url;
  }
}

