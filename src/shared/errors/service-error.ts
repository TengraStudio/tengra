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
    options?: { cause?: Error; context?: Record<string, unknown> }
  ) {
    super(message, code, options);
    this.serviceName = serviceName;
  }
}
