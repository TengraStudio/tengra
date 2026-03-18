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
