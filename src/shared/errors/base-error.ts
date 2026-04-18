/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

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
  public readonly context?: Record<string, RuntimeValue>;
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
    options?: { cause?: Error; context?: Record<string, RuntimeValue> }
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
  public toJSON(): Record<string, RuntimeValue> {
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
