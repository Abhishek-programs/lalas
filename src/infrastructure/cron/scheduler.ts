import cron from 'node-cron';
import { container } from '../../container';
import { PromptRepository } from '../database/PromptRepository';
import { PromptQueue } from '../queue/PromptQueue';
import { SubscriptionStatus } from '../../domain/entities';

export function startCronScheduler() {
  // Run every 10 seconds to scan for PENDING prompts
  cron.schedule('*/10 * * * * *', async () => {
    try {
      const promptRepo = container.resolve(PromptRepository);
      const promptQueue = container.resolve(PromptQueue);

      const pendingPrompts = await promptRepo.getPendingPrompts(20);

      for (const prompt of pendingPrompts) {
        const isPaid = (prompt as any).user_subscription_status === SubscriptionStatus.PAID;
        await promptQueue.enqueue(prompt.id, prompt.user_id, isPaid);
        // Immediately mark as PROCESSING to avoid re-enqueue
        // Actually, the worker will set PROCESSING. Let's use a different intermediary
        // or trust the worker. The worker sets PROCESSING on pickup.
        // To avoid duplicate enqueue, we could use a Redis lock or update status here.
        // For simplicity, let's update status to PROCESSING immediately when enqueued.
        await promptRepo.updateStatus(prompt.id, 'PROCESSING' as any);
      }

      if (pendingPrompts.length > 0) {
        console.log(`Cron: Enqueued ${pendingPrompts.length} prompts`);
      }
    } catch (err) {
      console.error('Cron error:', err);
    }
  });

  console.log('Cron scheduler started (scanning every 10 seconds)');
}
