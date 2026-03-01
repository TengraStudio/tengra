/**
 * Base error class for the Tengra application.
 * All domain-specific errors should extend this class.
 */
export class AppError extends Error {
  /** Machine-readable error code for programmatic handling */
  public readonly code: string;
  /** Optional underlying cause of this error */
  public readonly cause?: Error;
  /** Optional structured context for debugging */
  public readonly context?: Record<string, unknown>;
  /** ISO timestamp when the error was created */
  public readonly timestamp: string;

  /**
   * Creates a new AppError.
   * @param message - Human-readable error description
   * @param code - Machine-readable error code
   * @param options - Optional cause and context
   */
  constructor(
    message: string,
    code: string,
    options?: { cause?: Error; context?: Record<string, unknown> }
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.cause = options?.cause;
    this.context = options?.context;
    this.timestamp = new Date().toISOString();

    // Restore prototype chain for proper instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /** Serializes the error to a plain object */
  public toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      timestamp: this.timestamp,
      context: this.context,
      cause: this.cause?.message
    };
  }
}
