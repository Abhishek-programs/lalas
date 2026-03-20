import { Request, Response, NextFunction } from 'express';
import { container } from '../../../container';
import { RedisService } from '../../../infrastructure/redis/RedisService';

export const cacheMiddleware = (ttlSeconds: number = 60) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET') {
      return next();
    }

    try {
      const redisService = container.resolve(RedisService);
      // Construct a cache key based on URL and query params
      const key = `cache:${req.originalUrl}`;
      
      const cachedResponse = await redisService.get(key);
      if (cachedResponse) {
        return res.status(200).json(JSON.parse(cachedResponse));
      }

      const originalJson = res.json.bind(res);
      res.json = (body: any) => {
        redisService.set(key, JSON.stringify(body), ttlSeconds).catch(err => {
          console.error('Cache set error', err);
        });
        return originalJson(body);
      };

      next();
    } catch (e) {
      console.error('Cache middleware error', e);
      // Fail open
      next();
    }
  };
};

export const invalidateCachePrefix = async (prefix: string) => {
  try {
    const redisService = container.resolve(RedisService);
    const client = redisService.redisClient;
    // Simple logic to delete keys with a prefix pattern
    const keys = await client.keys(`cache:${prefix}*`);
    if (keys.length > 0) {
      await client.del(...keys);
    }
  } catch (e) {
    console.error('Cache invalidation error', e);
  }
};
