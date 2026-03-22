import { Router, Response } from 'express';
import { container } from '../../../container';
import { PromptRepository } from '../../../infrastructure/database/PromptRepository';
import { AuthenticatedRequest, authMiddleware } from '../middlewares/AuthMiddleware';
import { rateLimiter } from '../middlewares/RateLimiterMiddleware';

const router = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isValidUUID = (id: string) => UUID_RE.test(id);

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
    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'text is required' });
    }

    const promptRepo = container.resolve(PromptRepository);
    const prompt = await promptRepo.create({
      user_id: req.user!.id,
      text: text.trim(),
    });

    return res.status(202).json({
      message: 'Prompt accepted for processing',
      data: prompt,
    });
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
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
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Prompt details }
 *       400: { description: Invalid UUID }
 *       404: { description: Prompt not found }
 */
router.get('/:id', authMiddleware, rateLimiter, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    if (!isValidUUID(id)) {
      return res.status(400).json({ error: 'Invalid prompt ID format' });
    }
    const promptRepo = container.resolve(PromptRepository);
    const prompt = await promptRepo.findById(id);
    if (!prompt) {
      return res.status(404).json({ error: 'Prompt not found' });
    }
    return res.status(200).json(prompt);
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
