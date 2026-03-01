import { AppError } from './base-error';

/** Describes a single validation failure */
export interface ValidationIssue {
  field: string
  message: string
}

/**
 * Error thrown when input validation fails.
 * Use for schema violations, invalid parameters, or constraint failures.
 */
export class ValidationError extends AppError {
  /** List of individual validation issues */
  public readonly issues: ReadonlyArray<ValidationIssue>;

  /**
   * Creates a new ValidationError.
   * @param message - Human-readable error description
   * @param issues - List of validation issues found
   * @param options - Optional cause and context
   */
  constructor(
    message: string,
    issues: ValidationIssue[] = [],
    options?: { cause?: Error; context?: Record<string, unknown> }
  ) {
    super(message, 'VALIDATION_ERROR', options);
    this.issues = issues;
  }
}
