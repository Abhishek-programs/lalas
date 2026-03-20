import { Router, Response } from 'express';
import { container } from '../../../container';
import { PromptRepository } from '../../../infrastructure/database/PromptRepository';
import { AuthenticatedRequest, authMiddleware } from '../middlewares/AuthMiddleware';
import { rateLimiter } from '../middlewares/RateLimiterMiddleware';

const router = Router();

/**
 * @swagger
 * /prompts:
 *   post:
 *     summary: Submit a new prompt for audio generation
 *     tags: [Prompts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [text]
 *             properties:
 *               text: { type: string }
 *     responses:
 *       202: { description: Prompt accepted for processing }
 *       400: { description: Validation error }
 */
router.post('/', authMiddleware, rateLimiter, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'text is required' });
    }

    const promptRepo = container.resolve(PromptRepository);
    const prompt = await promptRepo.create({
      user_id: req.user!.id,
      text,
    });

    return res.status(202).json({
      message: 'Prompt accepted for processing',
      prompt,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /prompts/{id}:
 *   get:
 *     summary: Get prompt status
 *     tags: [Prompts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Prompt details }
 *       404: { description: Prompt not found }
 */
router.get('/:id', authMiddleware, rateLimiter, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const promptRepo = container.resolve(PromptRepository);
    const prompt = await promptRepo.findById(req.params.id as string);
    if (!prompt) {
      return res.status(404).json({ error: 'Prompt not found' });
    }
    return res.status(200).json(prompt);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
