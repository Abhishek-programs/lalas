import { Router, Response } from 'express';
import { container } from '../../../container';
import { UserRepository } from '../../../infrastructure/database/UserRepository';
import { AuthenticatedRequest, authMiddleware } from '../middlewares/AuthMiddleware';
import { cacheMiddleware, invalidateCachePrefix } from '../middlewares/CacheMiddleware';
import { rateLimiter } from '../middlewares/RateLimiterMiddleware';

const router = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(id: string) {
  return UUID_RE.test(id);
}

/**
 * @swagger
 * /users:
 *   get:
 *     summary: List all users (paginated, cached)
 *     tags: [Users]
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
 *       200: { description: Paginated user list }
 */
router.get('/', authMiddleware, rateLimiter, cacheMiddleware(60), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userRepo = container.resolve(UserRepository);
    const cursor = req.query.cursor as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
    const result = await userRepo.findAll(cursor, limit);

    const sanitized = {
      ...result,
      data: result.data.map(({ password, refresh_token, ...rest }) => rest),
    };
    return res.status(200).json(sanitized);
  } catch (err: any) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     summary: Get a user by ID (cached)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: User found }
 *       400: { description: Invalid UUID }
 *       404: { description: User not found }
 */
router.get('/:id', authMiddleware, rateLimiter, cacheMiddleware(60), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    if (!isValidUUID(id)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }
    const userRepo = container.resolve(UserRepository);
    const user = await userRepo.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const { password, refresh_token, ...sanitized } = user;
    return res.status(200).json(sanitized);
  } catch (err: any) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /users/{id}:
 *   put:
 *     summary: Update a user (invalidates cache)
 *     tags: [Users]
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
 *               display_name: { type: string }
 *     responses:
 *       200: { description: User updated }
 *       400: { description: Invalid UUID or missing fields }
 *       404: { description: User not found }
 */
router.put('/:id', authMiddleware, rateLimiter, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    if (!isValidUUID(id)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }
    if (!req.body.display_name) {
      return res.status(400).json({ error: 'display_name is required' });
    }
    const userRepo = container.resolve(UserRepository);
    const user = await userRepo.update(id, { display_name: req.body.display_name });
    await invalidateCachePrefix('/users');
    const { password, refresh_token, ...sanitized } = user;
    return res.status(200).json(sanitized);
  } catch (err: any) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
