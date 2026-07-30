import { prisma } from '../config/db';
import { HttpError } from '../middleware/error.middleware';
import { AuthTokens, User } from '../types';
import {
  generateRefreshToken,
  hashToken,
  refreshTokenTtlMs,
  signAccessToken,
} from '../utils/jwt';
import { hashPassword, verifyPassword } from '../utils/password';
import { LoginInput, RegisterInput } from '../validators/auth.validators';

/** Public-safe user view (never includes passwordHash). */
function toPublicUser(u: {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}): User {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
}

/** Issue an access token + a fresh (rotated) refresh token for a user. */
async function issueTokens(userId: string, email: string): Promise<AuthTokens> {
  const accessToken = signAccessToken({ sub: userId, email });
  const { token: refreshToken, tokenHash } = generateRefreshToken();

  await prisma.refreshToken.create({
    data: {
      tokenHash,
      userId,
      expiresAt: new Date(Date.now() + refreshTokenTtlMs()),
    },
  });

  return { accessToken, refreshToken };
}

export const authService = {
  async register(input: RegisterInput): Promise<{ user: User; tokens: AuthTokens }> {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new HttpError(409, 'An account with this email already exists', 'EMAIL_TAKEN');
    }

    const passwordHash = await hashPassword(input.password);
    const user = await prisma.user.create({
      data: { email: input.email, name: input.name, passwordHash },
    });

    const tokens = await issueTokens(user.id, user.email);
    return { user: toPublicUser(user), tokens };
  },

  async login(input: LoginInput): Promise<{ user: User; tokens: AuthTokens }> {
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    // Same error whether the email or password is wrong (avoid user enumeration).
    if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
      throw new HttpError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
    }

    const tokens = await issueTokens(user.id, user.email);
    return { user: toPublicUser(user), tokens };
  },

  /**
   * Validate an incoming refresh token and ROTATE it: the presented token is
   * revoked and a brand-new refresh token is issued (D-3). Reuse of an already
   * revoked/expired token is rejected.
   */
  async refresh(rawToken: string): Promise<AuthTokens> {
    const tokenHash = hashToken(rawToken);
    const stored = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!stored || stored.revokedAt || stored.expiresAt.getTime() < Date.now()) {
      throw new HttpError(401, 'Invalid or expired refresh token', 'INVALID_REFRESH_TOKEN');
    }

    // Rotate: revoke the old token, then issue a new pair.
    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return issueTokens(stored.user.id, stored.user.email);
  },

  /** Revoke a refresh token on logout (idempotent — unknown tokens are a no-op). */
  async logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken) return;
    const tokenHash = hashToken(rawToken);
    await prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },
};
