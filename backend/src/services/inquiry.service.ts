import { Prisma } from '@prisma/client';
import { prisma } from '../config/db';
import { HttpError } from '../middleware/error.middleware';
import { CreateInquiryInput } from '../validators/inquiry.validators';

export type CreateInquiryResult =
  | { status: 'created'; inquiry: Prisma.InquiryGetPayload<object> }
  | { status: 'duplicate' }
  | { status: 'spam' };

/** Count links in a message — a crude but effective content-spam signal. */
function looksSpammy(message: string): boolean {
  const links = (message.match(/https?:\/\//gi) ?? []).length;
  return links >= 3;
}

export const inquiryService = {
  /**
   * Submit an inquiry against a property (Session 7). Layered anti-spam:
   *  1. Honeypot field (`website`) filled  → silently dropped as spam.
   *  2. Content filter (≥3 links)          → silently dropped as spam.
   *  3. DB unique (property+email+day)      → duplicate (409).
   * (Per-IP rate limiting is applied upstream in the route.)
   *
   * Spam is dropped *silently* (reported as success to the caller) so bots get
   * no signal about why they failed; nothing is persisted.
   */
  async create(propertyId: string, input: CreateInquiryInput): Promise<CreateInquiryResult> {
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { id: true },
    });
    if (!property) throw new HttpError(404, 'Property not found', 'NOT_FOUND');

    if ((input.website && input.website.trim() !== '') || looksSpammy(input.message)) {
      return { status: 'spam' };
    }

    try {
      const inquiry = await prisma.inquiry.create({
        data: {
          propertyId,
          inquirerName: input.inquirerName,
          inquirerEmail: input.inquirerEmail,
          inquirerPhone: input.inquirerPhone,
          message: input.message,
        },
      });
      return { status: 'created', inquiry };
    } catch (err) {
      // P2002 = unique constraint violation (the daily-duplicate guard).
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return { status: 'duplicate' };
      }
      throw err;
    }
  },

  /** Owner-only: list leads for a property, newest first. */
  async listForProperty(propertyId: string) {
    return prisma.inquiry.findMany({
      where: { propertyId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  },
};
