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
 * Error thrown by LLM service operations.
 * Use for model failures, API errors, authentication issues, or rate-limiting.
 */
export class LLMError extends AppError {
  /** The LLM provider that produced this error (e.g. 'openai', 'anthropic') */
  public readonly provider: string;

  /**
   * Creates a new LLMError.
   * @param provider - Provider identifier (e.g. 'openai', 'anthropic')
   * @param message - Human-readable error description
   * @param code - Machine-readable error code
   * @param options - Optional cause and context
   */
  constructor(
    provider: string,
    message: string,
    code: string = 'LLM_ERROR',
    options?: { cause?: Error; context?: Record<string, RuntimeValue> }
  ) {
    super(message, code, options);
    this.provider = provider;
  }
}

