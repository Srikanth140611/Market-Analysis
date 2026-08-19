export class LiveDataUnavailableError extends Error {
  readonly statusCode = 503;
  readonly details?: string;

  constructor(message: string, details?: string) {
    super(message);
    this.name = "LiveDataUnavailableError";
    this.details = details;
  }
}

export function isLiveDataUnavailableError(error: unknown): error is LiveDataUnavailableError {
  return error instanceof LiveDataUnavailableError;
}

export function throwLiveDataUnavailable(message: string, details?: string): never {
  throw new LiveDataUnavailableError(message, details);
}