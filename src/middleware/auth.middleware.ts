import { Request, Response, NextFunction } from 'express';

export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const apiKey = process.env.API_KEY;

  if (!apiKey) {
    res.status(500).json({
      error: {
        code: 'SERVER_CONFIGURATION_ERROR',
        message: 'API key is not configured'
      }
    });

    return;
  }

  const authorization = req.header('Authorization');

  if (!authorization || !authorization.startsWith('Bearer ')) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Bearer token is required'
      }
    });

    return;
  }

  const token = authorization.slice('Bearer '.length);

  if (token !== apiKey) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid API key'
      }
    });

    return;
  }

  next();
}