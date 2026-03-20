import { Queue, QueueEvents } from 'bullmq';
import { singleton } from 'tsyringe';
import { ENV } from '../../config/env';

export const QUEUE_NAME = 'prompt-processing';

@singleton()
export class PromptQueue {
  public queue: Queue;
  public queueEvents: QueueEvents;

  constructor() {
    this.queue = new Queue(QUEUE_NAME, {
      connection: {
        host: new URL(ENV.REDIS_URL).hostname || 'localhost',
        port: parseInt(new URL(ENV.REDIS_URL).port) || 6379,
      },
    });

    this.queueEvents = new QueueEvents(QUEUE_NAME, {
      connection: {
        host: new URL(ENV.REDIS_URL).hostname || 'localhost',
        port: parseInt(new URL(ENV.REDIS_URL).port) || 6379,
      },
    });
  }

  /**
   * Enqueue a prompt for processing.
   * Paid users get priority 1 (higher), Free users get priority 2 (lower).
   */
  async enqueue(promptId: string, userId: string, isPaid: boolean): Promise<void> {
    await this.queue.add(
      'process-prompt',
      { promptId, userId },
      {
        priority: isPaid ? 1 : 2,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      }
    );
  }
}
