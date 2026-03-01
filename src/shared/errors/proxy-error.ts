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
    options?: { cause?: Error; context?: Record<string, unknown> }
  ) {
    super(message, code, options);
    this.recoverable = recoverable;
  }
}
