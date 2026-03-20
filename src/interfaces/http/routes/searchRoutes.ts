import { Router, Response } from 'express';
import { container } from '../../../container';
import { UserRepository } from '../../../infrastructure/database/UserRepository';
import { AudioRepository } from '../../../infrastructure/database/AudioRepository';
import { AuthenticatedRequest, authMiddleware } from '../middlewares/AuthMiddleware';
import { rateLimiter } from '../middlewares/RateLimiterMiddleware';

const router = Router();

/**
 * @swagger
 * /search:
 *   get:
 *     summary: Unified search across users and audio
 *     tags: [Search]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: user_cursor
 *         schema: { type: string }
 *       - in: query
 *         name: audio_cursor
 *         schema: { type: string }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200:
 *         description: Search results with weighted ranking
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 users:
 *                   type: object
 *                   properties:
 *                     data: { type: array }
 *                     meta:
 *                       type: object
 *                       properties:
 *                         next_cursor: { type: string, nullable: true }
 *                 audio:
 *                   type: object
 *                   properties:
 *                     data: { type: array }
 *                     meta:
 *                       type: object
 *                       properties:
 *                         next_cursor: { type: string, nullable: true }
 *       400: { description: Missing query parameter }
 */
router.get('/', authMiddleware, rateLimiter, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const q = req.query.q as string;
    if (!q) {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    const userCursor = req.query.user_cursor as string | undefined;
    const audioCursor = req.query.audio_cursor as string | undefined;
    const limit = parseInt(req.query.limit as string) || 10;

    const userRepo = container.resolve(UserRepository);
    const audioRepo = container.resolve(AudioRepository);

    const [userResults, audioResults] = await Promise.all([
      userRepo.search(q, userCursor, limit),
      audioRepo.search(q, audioCursor, limit),
    ]);

    // Strip sensitive fields from user results
    const sanitizedUsers = {
      ...userResults,
      data: userResults.data.map(({ password, refresh_token, ...rest }) => rest),
    };

    return res.status(200).json({
      users: sanitizedUsers,
      audio: audioResults,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
