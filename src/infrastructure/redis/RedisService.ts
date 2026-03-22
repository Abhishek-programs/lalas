import { singleton } from 'tsyringe';
import Redis from 'ioredis';
import { ENV } from '../../config/env';
import { IRedisService } from '../../application/interfaces';

@singleton()
export class RedisService implements IRedisService {
  private client: Redis;

  constructor() {
    const url = new URL(ENV.REDIS_URL);
    this.client = new Redis({
      host: url.hostname,
      port: Number(url.port) || 6379,
      password: url.password || undefined,
      username: url.username || undefined,
      tls: url.protocol === 'rediss:' ? {} : undefined,
      maxRetriesPerRequest: null,
      retryStrategy(times) {
        return Math.min(times * 50, 2000);
      },
    });

    this.client.on('error', (err) => {
      console.error('Redis error', err);
    });
  }

  get redisClient() {
    return this.client;
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async increment(key: string): Promise<number> {
    return this.client.incr(key);
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    await this.client.expire(key, ttlSeconds);
  }
}
