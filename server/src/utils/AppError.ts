export class AppError extends Error {
  public readonly statusCode: number;
  // Extra response headers, e.g. Retry-After on a 429.
  public readonly headers?: Record<string, string>;

  constructor(statusCode: number, message: string, headers?: Record<string, string>) {
    super(message);
    this.statusCode = statusCode;
    this.headers = headers;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}
