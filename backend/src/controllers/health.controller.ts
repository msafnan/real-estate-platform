import { Request, Response } from 'express';

/**
 * @openapi
 * /health:
 *   get:
 *     summary: Health check
 *     description: Returns basic liveness info. Does not touch the database.
 *     tags:
 *       - System
 *     responses:
 *       200:
 *         description: Service is up
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 uptime:
 *                   type: number
 *                   example: 12.34
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
export function getHealth(_req: Request, res: Response): void {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
}
