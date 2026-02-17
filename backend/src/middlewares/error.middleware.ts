import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: true,
      message: err.message,
    });
    return;
  }

  console.error('Erro não tratado:', err);
  res.status(500).json({
    error: true,
    message: 'Erro interno do servidor',
  });
}
