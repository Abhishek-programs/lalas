import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ENV } from '../../../config/env';
import { container } from '../../../container';
import { AuthService } from '../../../application/use-cases/AuthService';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    subscription_status: string;
  };
  token?: string;
}

export const authMiddleware = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];

    // Check blacklist
    const authService = container.resolve(AuthService);
    const isBlacklisted = await authService.isTokenBlacklisted(token);
    if (isBlacklisted) {
      return res.status(401).json({ error: 'Token has been revoked' });
    }

    const decoded = jwt.verify(token, ENV.JWT_SECRET) as any;

    req.user = {
      id: decoded.sub,
      email: decoded.email,
      subscription_status: decoded.subscription_status,
    };
    req.token = token;

    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};
