import dotenv from 'dotenv';
dotenv.config();

export const ENV = {
  PORT: process.env.PORT || 3000,
  DATABASE_URL: process.env.DATABASE_URL as string,
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  JWT_SECRET: process.env.JWT_SECRET || 'super-secret-key-change-me',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'super-secret-refresh-key-change-me',
  JWT_EXPIRY: '15m',
  JWT_REFRESH_EXPIRY: '30d',
};
