import { Request, Response, NextFunction } from 'express';
import { forbidden } from '../utils/errors.js';

export const requireRole = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      throw forbidden('User authentication required');
    }

    if (!roles.includes(req.user.role)) {
      throw forbidden(`Insufficient permissions. Required roles: ${roles.join(', ')}`);
    }

    next();
  };
};
