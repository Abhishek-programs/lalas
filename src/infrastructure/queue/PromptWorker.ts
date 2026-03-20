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

      // 1. Set status to PROCESSING
      await promptRepo.updateStatus(promptId, PromptStatus.PROCESSING);

      // 2. Simulate processing delay (2-5 seconds)
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
      // Import dynamically to avoid circular dependency
      const { WebSocketService } = require('../../interfaces/ws/WebSocketService');
      const wsService = container.resolve(WebSocketService) as any;
      wsService.notifyUser(userId, {
        type: 'PROMPT_COMPLETED',
        promptId,
        audio,
      });

      return { audioId: audio.id };
    },
    {
      connection: {
        host: redisUrl.hostname || 'localhost',
        port: parseInt(redisUrl.port) || 6379,
      },
      concurrency: 5,
    }
  );

  worker.on('completed', (job) => {
    console.log(`Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} failed:`, err.message);
  });

  console.log('Prompt processing worker started');
  return worker;
}
