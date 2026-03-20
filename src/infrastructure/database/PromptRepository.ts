import { injectable, inject } from 'tsyringe';
import { PrismaService } from './prisma';
import { IPromptRepository } from '../../application/interfaces';
import { Prompt, PromptStatus } from '../../domain/entities';

@injectable()
export class PromptRepository implements IPromptRepository {
  constructor(@inject(PrismaService) private prisma: PrismaService) {}

  private map(data: any): Prompt {
    return {
      id: data.id,
      user_id: data.user_id,
      text: data.text,
      status: data.status as PromptStatus,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  }

  async findById(id: string): Promise<Prompt | null> {
    const prompt = await this.prisma.client.prompt.findUnique({ where: { id } });
    return prompt ? this.map(prompt) : null;
  }

  async create(data: Partial<Prompt>): Promise<Prompt> {
    const prompt = await this.prisma.client.prompt.create({
      data: {
        user_id: data.user_id!,
        text: data.text!,
        status: data.status || 'PENDING',
      }
    });
    return this.map(prompt);
  }

  async updateStatus(id: string, status: PromptStatus): Promise<Prompt> {
    const prompt = await this.prisma.client.prompt.update({
      where: { id },
      data: { status }
    });
    return this.map(prompt);
  }

  async getPendingPrompts(limit: number): Promise<Prompt[]> {
    const prompts = await this.prisma.client.prompt.findMany({
      where: { status: 'PENDING' },
      orderBy: { created_at: 'asc' },
      take: limit,
      include: { user: true } // Need user sub_status for priority logic if done here, or handle outside
    });
    // Let's just return mapped, the worker might fetch user or we map it
    return prompts.map(p => {
      const mapped = this.map(p);
      // extend with user sub status hackily or handle in Cron
      (mapped as any).user_subscription_status = (p as any).user?.subscription_status;
      return mapped;
    });
  }
}
