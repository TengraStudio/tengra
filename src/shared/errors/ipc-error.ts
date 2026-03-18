import { AppError } from './base-error';

/**
 * Error thrown during IPC communication between main and renderer processes.
 * Use for handler registration failures, serialization issues, or channel errors.
 */
export class IpcError extends AppError {
  /** The IPC channel that produced this error */
  public readonly channel: string;

  /**
   * Creates a new IpcError.
   * @param channel - The IPC channel name
   * @param message - Human-readable error description
   * @param code - Machine-readable error code
   * @param options - Optional cause and context
   */
  constructor(
    channel: string,
    message: string,
    code: string = 'IPC_ERROR',
    options?: { cause?: Error; context?: Record<string, RuntimeValue> }
  ) {
    super(message, code, options);
    this.channel = channel;
  }
}
