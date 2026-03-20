import 'reflect-metadata';
import { container } from 'tsyringe';
import { PrismaService } from './infrastructure/database/prisma';
import { RedisService } from './infrastructure/redis/RedisService';
import { UserRepository } from './infrastructure/database/UserRepository';
import { AudioRepository } from './infrastructure/database/AudioRepository';
import { PromptRepository } from './infrastructure/database/PromptRepository';
import { PromptQueue } from './infrastructure/queue/PromptQueue';
import { AuthService } from './application/use-cases/AuthService';
import { SubscriptionService } from './application/use-cases/SubscriptionService';
import { WebSocketService } from './interfaces/ws/WebSocketService';

// Register singletons
container.registerSingleton(PrismaService);
container.registerSingleton(RedisService);
container.registerSingleton(WebSocketService);
container.registerSingleton(PromptQueue);

// Register repositories (interface -> concrete)
container.register('IUserRepository', { useClass: UserRepository });
container.register('IAudioRepository', { useClass: AudioRepository });
container.register('IPromptRepository', { useClass: PromptRepository });

// Register services
container.register(AuthService, { useClass: AuthService });
container.register(SubscriptionService, { useClass: SubscriptionService });

export { container };
