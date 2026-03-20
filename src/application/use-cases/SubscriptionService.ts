import { injectable, inject } from 'tsyringe';
import { IUserRepository, IRedisService } from '../interfaces';
import { SubscriptionStatus, User } from '../../domain/entities';

@injectable()
export class SubscriptionService {
  constructor(
    @inject('IUserRepository') private userRepository: IUserRepository,
  ) {}

  async subscribe(userId: string): Promise<User> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    
    // Assuming payment verification is handled elsewhere
    return this.userRepository.update(userId, { subscription_status: SubscriptionStatus.PAID });
  }

  async cancel(userId: string): Promise<User> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    return this.userRepository.update(userId, { subscription_status: SubscriptionStatus.FREE });
  }
}
