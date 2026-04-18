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
 * Error thrown during proxy operations.
 * Use for proxy startup failures, configuration errors, or routing issues.
 */
export class ProxyError extends AppError {
  /** Whether the error is recoverable via retry */
  public readonly recoverable: boolean;

  /**
   * Creates a new ProxyError.
   * @param message - Human-readable error description
   * @param code - Machine-readable error code
   * @param recoverable - Whether the error can be retried
   * @param options - Optional cause and context
   */
  constructor(
    message: string,
    code: string = 'PROXY_ERROR',
    recoverable: boolean = false,
    options?: { cause?: Error; context?: Record<string, RuntimeValue> }
  ) {
    super(message, code, options);
    this.recoverable = recoverable;
  }
}
