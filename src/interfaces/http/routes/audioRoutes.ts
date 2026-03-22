import { Router, Response } from 'express';
import { container } from '../../../container';
import { AudioRepository } from '../../../infrastructure/database/AudioRepository';
import { AuthenticatedRequest, authMiddleware } from '../middlewares/AuthMiddleware';
import { cacheMiddleware, invalidateCachePrefix } from '../middlewares/CacheMiddleware';
import { rateLimiter } from '../middlewares/RateLimiterMiddleware';

const router = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isValidUUID = (id: string) => UUID_RE.test(id);

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
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
    const result = await audioRepo.findAll(cursor, limit);
    return res.status(200).json(result);
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
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
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Audio found }
 *       400: { description: Invalid UUID }
 *       404: { description: Audio not found }
 */
router.get('/:id', authMiddleware, rateLimiter, cacheMiddleware(60), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    if (!isValidUUID(id)) {
      return res.status(400).json({ error: 'Invalid audio ID format' });
    }
    const audioRepo = container.resolve(AudioRepository);
    const audio = await audioRepo.findById(id);
    if (!audio) {
      return res.status(404).json({ error: 'Audio not found' });
    }
    return res.status(200).json(audio);
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
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
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string }
 *     responses:
 *       200: { description: Audio updated }
 *       400: { description: Invalid UUID or missing fields }
 *       404: { description: Audio not found }
 */
router.put('/:id', authMiddleware, rateLimiter, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    if (!isValidUUID(id)) {
      return res.status(400).json({ error: 'Invalid audio ID format' });
    }
    if (!req.body.title) {
      return res.status(400).json({ error: 'title is required' });
    }
    const audioRepo = container.resolve(AudioRepository);
    const audio = await audioRepo.update(id, { title: req.body.title });
    await invalidateCachePrefix('/audio');
    return res.status(200).json(audio);
  } catch (err: any) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Audio not found' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
