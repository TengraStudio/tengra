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
    options?: { cause?: Error; context?: Record<string, RuntimeValue> }
  ) {
    super(message, 'VALIDATION_ERROR', options);
    this.issues = issues;
  }
}
