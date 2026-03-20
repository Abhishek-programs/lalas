import { Router, Request, Response } from 'express';
import { container } from '../../../container';
import { AuthService } from '../../../application/use-cases/AuthService';
import { AuthenticatedRequest, authMiddleware } from '../middlewares/AuthMiddleware';

const router = Router();

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, display_name]
 *             properties:
 *               email: { type: string }
 *               password: { type: string }
 *               display_name: { type: string }
 *     responses:
 *       201: { description: Registration successful }
 *       400: { description: Email already in use }
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, display_name } = req.body;
    if (!email || !password || !display_name) {
      return res.status(400).json({ error: 'email, password, and display_name are required' });
    }
    const authService = container.resolve(AuthService);
    const tokens = await authService.register(email, password, display_name);
    return res.status(201).json(tokens);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login a user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string }
 *               password: { type: string }
 *     responses:
 *       200: { description: Login successful }
 *       401: { description: Invalid credentials }
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }
    const authService = container.resolve(AuthService);
    const tokens = await authService.login(email, password);
    return res.status(200).json(tokens);
  } catch (err: any) {
    return res.status(401).json({ error: err.message });
  }
});

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200: { description: Tokens refreshed }
 *       401: { description: Invalid refresh token }
 */
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: 'refreshToken is required' });
    }
    const authService = container.resolve(AuthService);
    const tokens = await authService.refresh(refreshToken);
    return res.status(200).json(tokens);
  } catch (err: any) {
    return res.status(401).json({ error: err.message });
  }
});

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Logout user (invalidate tokens)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Logged out successfully }
 *       401: { description: Unauthorized }
 */
router.post('/logout', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const authService = container.resolve(AuthService);
    await authService.logout(req.user!.id, req.token!);
    return res.status(200).json({ message: 'Logged out successfully' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
