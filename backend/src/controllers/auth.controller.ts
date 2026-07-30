import { CookieOptions, Request, Response } from 'express';
import { env } from '../config/env';
import { authService } from '../services/auth.service';
import { refreshTokenTtlMs } from '../utils/jwt';

const REFRESH_COOKIE = 'refreshToken';

/** httpOnly cookie config for the refresh token (D-3). */
function refreshCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.isProd,
    // In prod the frontend is a different origin → SameSite=None+Secure.
    // In dev over http, Lax keeps Postman/curl testing simple.
    sameSite: env.isProd ? 'none' : 'lax',
    path: '/api/auth',
    maxAge: refreshTokenTtlMs(),
  };
}

/**
 * @openapi
 * components:
 *   schemas:
 *     AuthUser:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         email: { type: string, format: email }
 *         name: { type: string }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *     AuthResponse:
 *       type: object
 *       properties:
 *         user: { $ref: '#/components/schemas/AuthUser' }
 *         accessToken: { type: string, description: 'JWT access token (15 min)' }
 */

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     summary: Register a new account
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, name, password]
 *             properties:
 *               email: { type: string, format: email, example: jane@example.com }
 *               name: { type: string, example: Jane Doe }
 *               password: { type: string, example: Password123 }
 *     responses:
 *       201:
 *         description: Account created; sets refresh-token cookie, returns access token.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AuthResponse' }
 *       409: { description: Email already registered }
 *       400: { description: Validation error }
 */
export async function register(req: Request, res: Response): Promise<void> {
  const { user, tokens } = await authService.register(req.body);
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, refreshCookieOptions());
  res.status(201).json({ user, accessToken: tokens.accessToken });
}

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     summary: Log in with email + password
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email, example: jane@example.com }
 *               password: { type: string, example: Password123 }
 *     responses:
 *       200:
 *         description: Logged in; sets refresh-token cookie, returns access token.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AuthResponse' }
 *       401: { description: Invalid credentials }
 */
export async function login(req: Request, res: Response): Promise<void> {
  const { user, tokens } = await authService.login(req.body);
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, refreshCookieOptions());
  res.status(200).json({ user, accessToken: tokens.accessToken });
}

/**
 * @openapi
 * /api/auth/refresh:
 *   post:
 *     summary: Rotate the refresh token and get a new access token
 *     description: Reads the refresh token from the httpOnly cookie, rotates it, and returns a fresh access token.
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: New access token issued; refresh cookie rotated.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken: { type: string }
 *       401: { description: Missing/invalid/expired refresh token }
 */
export async function refresh(req: Request, res: Response): Promise<void> {
  const rawToken = req.cookies?.[REFRESH_COOKIE] as string | undefined;
  if (!rawToken) {
    res.status(401).json({ error: { message: 'No refresh token', code: 'NO_REFRESH_TOKEN' } });
    return;
  }
  const tokens = await authService.refresh(rawToken);
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, refreshCookieOptions());
  res.status(200).json({ accessToken: tokens.accessToken });
}

/**
 * @openapi
 * /api/auth/logout:
 *   post:
 *     summary: Log out (revoke the refresh token)
 *     tags: [Auth]
 *     responses:
 *       204: { description: Logged out; refresh cookie cleared. }
 */
export async function logout(req: Request, res: Response): Promise<void> {
  const rawToken = req.cookies?.[REFRESH_COOKIE] as string | undefined;
  await authService.logout(rawToken);
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
  res.status(204).send();
}

/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     summary: Get the currently authenticated user
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: The authenticated user's identity from the access token.
 *       401: { description: Not authenticated }
 */
export async function me(req: Request, res: Response): Promise<void> {
  res.status(200).json({ user: req.user });
}
