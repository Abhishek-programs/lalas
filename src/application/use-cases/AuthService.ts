import { injectable, inject } from 'tsyringe';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { IUserRepository } from '../interfaces';
import { User } from '../../domain/entities';
import { ENV } from '../../config/env';
import { RedisService } from '../../infrastructure/redis/RedisService';

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

@injectable()
export class AuthService {
  constructor(
    @inject('IUserRepository') private userRepository: IUserRepository,
    @inject(RedisService) private redisService: RedisService,
  ) {}

  async register(email: string, password: string, displayName: string): Promise<AuthTokens> {
    const existing = await this.userRepository.findByEmail(email);
    if (existing) {
      throw new Error('Email already in use');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await this.userRepository.create({
      email,
      password: hashedPassword,
      display_name: displayName,
    });

    return this.generateTokens(user);
  }

  async login(email: string, password: string): Promise<AuthTokens> {
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new Error('Invalid credentials');
    }

    const valid = await bcrypt.compare(password, user.password!);
    if (!valid) {
      throw new Error('Invalid credentials');
    }

    return this.generateTokens(user);
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    try {
      const payload = jwt.verify(refreshToken, ENV.JWT_REFRESH_SECRET) as any;
      const user = await this.userRepository.findById(payload.sub);

      if (!user || user.refresh_token !== refreshToken) {
        throw new Error('Invalid refresh token');
      }

      // Token rotation: issue new pair and invalidate old refresh token
      return this.generateTokens(user);
    } catch (err) {
      throw new Error('Invalid refresh token');
    }
  }

  async logout(userId: string, accessToken: string): Promise<void> {
    // Remove refresh token from DB
    await this.userRepository.updateRefreshToken(userId, null);

    // Blacklist the current access token in Redis until it expires
    try {
      const decoded = jwt.decode(accessToken) as any;
      if (decoded && decoded.exp) {
        const ttl = decoded.exp - Math.floor(Date.now() / 1000);
        if (ttl > 0) {
          await this.redisService.set(`blacklist:${accessToken}`, '1', ttl);
        }
      }
    } catch {
      // Ignore decode errors
    }
  }

  async isTokenBlacklisted(token: string): Promise<boolean> {
    const result = await this.redisService.get(`blacklist:${token}`);
    return result !== null;
  }

  private async generateTokens(user: User): Promise<AuthTokens> {
    const accessToken = jwt.sign(
      { sub: user.id, email: user.email, subscription_status: user.subscription_status },
      ENV.JWT_SECRET,
      { expiresIn: 900 } // 15 minutes in seconds
    );

    const refreshToken = jwt.sign(
      { sub: user.id },
      ENV.JWT_REFRESH_SECRET,
      { expiresIn: 2592000 } // 30 days in seconds
    );

    // Store refresh token in DB (token rotation)
    await this.userRepository.updateRefreshToken(user.id, refreshToken);

    return { accessToken, refreshToken };
  }
}
