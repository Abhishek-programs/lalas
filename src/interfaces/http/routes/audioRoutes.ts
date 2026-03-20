import { Router, Response } from 'express';
import { container } from '../../../container';
import { AudioRepository } from '../../../infrastructure/database/AudioRepository';
import { AuthenticatedRequest, authMiddleware } from '../middlewares/AuthMiddleware';
import { cacheMiddleware, invalidateCachePrefix } from '../middlewares/CacheMiddleware';
import { rateLimiter } from '../middlewares/RateLimiterMiddleware';

const router = Router();

/**
 * @swagger
 * /audio:
 *   get:
 *     summary: List all audio (paginated, cached)
 *     tags: [Audio]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: cursor
 *         schema: { type: string }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200: { description: Paginated audio list }
 */
router.get('/', authMiddleware, rateLimiter, cacheMiddleware(60), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const audioRepo = container.resolve(AudioRepository);
    const cursor = req.query.cursor as string | undefined;
    const limit = parseInt(req.query.limit as string) || 10;
    const result = await audioRepo.findAll(cursor, limit);
    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /audio/{id}:
 *   get:
 *     summary: Get audio by ID (cached)
 *     tags: [Audio]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Audio found }
 *       404: { description: Audio not found }
 */
router.get('/:id', authMiddleware, rateLimiter, cacheMiddleware(60), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const audioRepo = container.resolve(AudioRepository);
    const audio = await audioRepo.findById(req.params.id as string);
    if (!audio) {
      return res.status(404).json({ error: 'Audio not found' });
    }
    return res.status(200).json(audio);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /audio/{id}:
 *   put:
 *     summary: Update audio title (invalidates cache)
 *     tags: [Audio]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string }
 *     responses:
 *       200: { description: Audio updated }
 */
router.put('/:id', authMiddleware, rateLimiter, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const audioRepo = container.resolve(AudioRepository);
    const audio = await audioRepo.update(req.params.id as string, { title: req.body.title });
    await invalidateCachePrefix('/audio');
    return res.status(200).json(audio);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
