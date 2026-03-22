import { Worker, Job } from 'bullmq';
import { container } from '../../container';
import { QUEUE_NAME } from './PromptQueue';
import { PromptRepository } from '../database/PromptRepository';
import { AudioRepository } from '../database/AudioRepository';
import { PromptStatus } from '../../domain/entities';
import { ENV } from '../../config/env';

export function startWorker() {
  const redisUrl = new URL(ENV.REDIS_URL);

  const worker = new Worker(
    QUEUE_NAME,
    async (job: Job) => {
      const { promptId, userId } = job.data;

      const promptRepo = container.resolve(PromptRepository);
      const audioRepo = container.resolve(AudioRepository);

      // 1. Set status to PROCESSING (idempotent — cron may have already set it)
      await promptRepo.updateStatus(promptId, PromptStatus.PROCESSING);

      // 2. Simulate processing delay (2–5 seconds)
      const delay = 2000 + Math.random() * 3000;
      await new Promise(resolve => setTimeout(resolve, delay));

      // 3. Create Audio entry
      const audio = await audioRepo.create({
        prompt_id: promptId,
        user_id: userId,
        title: `Generated Audio for Prompt ${promptId.substring(0, 8)}`,
        url: `https://cdn.musicgpt.ai/audio/${promptId}.mp3`,
      });

      // 4. Set status to COMPLETED
      await promptRepo.updateStatus(promptId, PromptStatus.COMPLETED);

      // 5. Send WebSocket notification to user
      const { WebSocketService } = require('../../interfaces/ws/WebSocketService');
      const wsService = container.resolve(WebSocketService) as any;
      wsService.notifyUser(userId, {
        type: 'prompt:completed',
        promptId,
        audioId: audio.id,
        audio,
      });

      return { audioId: audio.id };
    },
    {
      connection: {
        host: redisUrl.hostname,
        port: Number(redisUrl.port) || 6379,
        password: redisUrl.password || undefined,
        username: redisUrl.username || undefined,
        tls: redisUrl.protocol === 'rediss:' ? {} : undefined,
      },
      concurrency: 5,
    }
  );

  worker.on('completed', (job) => {
    console.log(`Job ${job.id} completed`);
  });

  worker.on('failed', async (job, err) => {
    console.error(`Job ${job?.id} failed:`, err.message);

    // When all retry attempts are exhausted, reset the prompt back to PENDING
    // so the cron scheduler can re-enqueue it on the next cycle.
    if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
      try {
        const promptRepo = container.resolve(PromptRepository);
        await promptRepo.updateStatus(job.data.promptId, PromptStatus.PENDING);
        console.log(`Reset prompt ${job.data.promptId} to PENDING after all retries failed`);
      } catch (resetErr) {
        console.error('Failed to reset prompt status:', resetErr);
      }
    }
  });

  console.log('Prompt processing worker started');
  return worker;
}
