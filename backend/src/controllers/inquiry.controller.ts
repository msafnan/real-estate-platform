import { Request, Response } from 'express';
import { HttpError } from '../middleware/error.middleware';
import { inquiryService } from '../services/inquiry.service';

/**
 * @openapi
 * components:
 *   schemas:
 *     Inquiry:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         propertyId: { type: string, format: uuid }
 *         inquirerName: { type: string }
 *         inquirerEmail: { type: string, format: email }
 *         inquirerPhone: { type: string, nullable: true }
 *         message: { type: string }
 *         createdAt: { type: string, format: date-time }
 */

/**
 * @openapi
 * /api/properties/{id}/inquiries:
 *   post:
 *     summary: Submit an inquiry (lead) for a property
 *     description: >
 *       Public endpoint. Anti-spam is layered: (1) a hidden honeypot field
 *       `website` — if filled, the submission is silently accepted but dropped;
 *       (2) a content filter drops messages with 3+ links (also silent);
 *       (3) a DB unique constraint blocks a repeat inquiry from the same email
 *       for the same property on the same day (409); (4) the route is
 *       rate-limited to 5 submissions per IP / 15 min. Silent drops return 200
 *       with `{ received: true }` so bots get no signal.
 *     tags: [Inquiries]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [inquirerName, inquirerEmail, message]
 *             properties:
 *               inquirerName: { type: string, example: Jane Buyer }
 *               inquirerEmail: { type: string, format: email, example: jane@example.com }
 *               inquirerPhone: { type: string, example: "+1 555 123 4567" }
 *               message: { type: string, example: Is this still available? }
 *               website: { type: string, description: 'Honeypot — leave empty.' }
 *     responses:
 *       201: { description: Inquiry created }
 *       200: { description: Accepted but dropped as spam (silent) }
 *       409: { description: Duplicate inquiry (already sent today) }
 *       404: { description: Property not found }
 *       429: { description: Rate limited }
 */
export async function createInquiry(req: Request, res: Response): Promise<void> {
  const result = await inquiryService.create(req.params.id, req.body);
  switch (result.status) {
    case 'created':
      res.status(201).json({ inquiry: result.inquiry });
      return;
    case 'duplicate':
      throw new HttpError(409, 'You have already sent an inquiry for this property today', 'DUPLICATE_INQUIRY');
    case 'spam':
      // Silent accept — do not reveal the spam heuristics.
      res.status(200).json({ received: true });
      return;
  }
}

/**
 * @openapi
 * /api/properties/{id}/inquiries:
 *   get:
 *     summary: List inquiries for a property (owner only)
 *     tags: [Inquiries]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Leads for the property, newest first }
 *       403: { description: Not the owner }
 *       404: { description: Property not found }
 */
export async function listInquiries(req: Request, res: Response): Promise<void> {
  const inquiries = await inquiryService.listForProperty(req.params.id);
  res.status(200).json({ inquiries });
}
