import { AppError } from './base-error';

/**
 * Error thrown during database operations.
 * Use for connection failures, query errors, migration issues, or schema violations.
 */
export class DatabaseError extends AppError {
  /** The SQL operation or table that triggered the error, if applicable */
  public readonly operation?: string;

  /**
   * Creates a new DatabaseError.
   * @param message - Human-readable error description
   * @param code - Machine-readable error code
   * @param options - Optional cause, context, and operation identifier
   */
  constructor(
    message: string,
    code: string = 'DATABASE_ERROR',
    options?: { cause?: Error; context?: Record<string, unknown>; operation?: string }
  ) {
    super(message, code, { cause: options?.cause, context: options?.context });
    this.operation = options?.operation;
  }
}
