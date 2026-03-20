import { Router, Response } from 'express';
import { container } from '../../../container';
import { SubscriptionService } from '../../../application/use-cases/SubscriptionService';
import { AuthenticatedRequest, authMiddleware } from '../middlewares/AuthMiddleware';

const router = Router();

/**
 * @swagger
 * /subscription/subscribe:
 *   post:
 *     summary: Upgrade to PAID subscription
 *     tags: [Subscription]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Subscription upgraded }
 *       401: { description: Unauthorized }
 */
router.post('/subscribe', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const subscriptionService = container.resolve(SubscriptionService);
    const user = await subscriptionService.subscribe(req.user!.id);
    return res.status(200).json({ message: 'Subscribed successfully', subscription_status: user.subscription_status });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

/**
 * @swagger
 * /subscription/cancel:
 *   post:
 *     summary: Cancel PAID subscription (downgrade to FREE)
 *     tags: [Subscription]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Subscription cancelled }
 *       401: { description: Unauthorized }
 */
router.post('/cancel', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const subscriptionService = container.resolve(SubscriptionService);
    const user = await subscriptionService.cancel(req.user!.id);
    return res.status(200).json({ message: 'Subscription cancelled', subscription_status: user.subscription_status });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

export default router;
