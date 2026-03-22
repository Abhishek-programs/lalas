import { Request, Response, NextFunction } from 'express';
import { container } from '../../../container';
import { RedisService } from '../../../infrastructure/redis/RedisService';
import { SubscriptionStatus } from '../../../domain/entities';

export const rateLimiter = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const redisService = container.resolve(RedisService);

    const user = (req as any).user;
    const identifier = user?.id || req.ip;
    const isPaid = user?.subscription_status === SubscriptionStatus.PAID;

    const limit = isPaid ? 100 : 20;
    const windowSecs = 60; // 1 minute window

    const key = `ratelimit:${identifier}`;
    const current = await redisService.increment(key);

    if (current === 1) {
      await redisService.expire(key, windowSecs);
    }

    // Expose rate limit info on every response
    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - current));

    if (current > limit) {
      res.setHeader('Retry-After', windowSecs);
      return res.status(429).json({
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Retry after ${windowSecs} seconds.`,
      });
    }

    next();
  } catch (error) {
    console.error('Rate limit error', error);
    // Fail open if Redis is down
    next();
  }
};
