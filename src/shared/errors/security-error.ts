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
 * Error thrown during security operations.
 * Use for encryption failures, key management issues, or authentication errors.
 */
export class SecurityError extends AppError {
  /** The security operation that failed (e.g. 'encrypt', 'decrypt', 'key-rotation') */
  public readonly operation?: string;

  /**
   * Creates a new SecurityError.
   * @param message - Human-readable error description
   * @param code - Machine-readable error code
   * @param options - Optional cause, context, and operation identifier
   */
  constructor(
    message: string,
    code: string = 'SECURITY_ERROR',
    options?: { cause?: Error; context?: Record<string, RuntimeValue>; operation?: string }
  ) {
    super(message, code, { cause: options?.cause, context: options?.context });
    this.operation = options?.operation;
  }
}

