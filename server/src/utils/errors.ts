export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code = 'ERROR',
    public details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (m: string, details?: unknown) => new AppError(400, m, 'BAD_REQUEST', details);
export const unauthorized = (m = 'Authentication required') => new AppError(401, m, 'UNAUTHORIZED');
export const notFound = (m = 'Not found') => new AppError(404, m, 'NOT_FOUND');
export const conflict = (m: string) => new AppError(409, m, 'CONFLICT');
