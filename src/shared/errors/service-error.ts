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
 * Error thrown by service-layer operations.
 * Use for failures in business logic, lifecycle, or dependency issues.
 */
export class ServiceError extends AppError {
  /** The service that produced this error */
  public readonly serviceName: string;

  /**
   * Creates a new ServiceError.
   * @param serviceName - Name of the service that failed
   * @param message - Human-readable error description
   * @param code - Machine-readable error code
   * @param options - Optional cause and context
   */
  constructor(
    serviceName: string,
    message: string,
    code: string = 'SERVICE_ERROR',
    options?: { cause?: Error; context?: Record<string, RuntimeValue> }
  ) {
    super(message, code, options);
    this.serviceName = serviceName;
  }
}
