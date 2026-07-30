import { z } from 'zod';

/** Strip angle brackets / tags and collapse whitespace (basic sanitization). */
const clean = (s: string) => s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

const phoneRegex = /^[+]?[\d\s().-]{7,20}$/;

export const createInquirySchema = z.object({
  body: z.object({
    inquirerName: z.string().min(1).max(120).transform(clean),
    // Email is required — it anchors the daily-duplicate constraint.
    inquirerEmail: z.string().email('Invalid email address').toLowerCase(),
    inquirerPhone: z
      .string()
      .regex(phoneRegex, 'Invalid phone number')
      .optional()
      .or(z.literal('').transform(() => undefined)),
    message: z.string().min(1).max(2000).transform(clean),
    // Honeypot: real users never see or fill this. Bots that auto-fill every
    // field will populate it → we treat the submission as spam. Kept optional
    // and unused otherwise.
    website: z.string().optional(),
  }),
});

export type CreateInquiryInput = z.infer<typeof createInquirySchema>['body'];
