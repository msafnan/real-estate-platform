import crypto from 'crypto';
import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';

export interface AccessTokenPayload {
  sub: string; // user id
  email: string;
}

/** Sign a short-lived access token (JWT, 15m by default — D-3). */
export function signAccessToken(payload: AccessTokenPayload): string {
  const options: SignOptions = { expiresIn: env.jwt.accessTtl as SignOptions['expiresIn'] };
  return jwt.sign(payload, env.jwt.accessSecret, options);
}

/** Verify an access token, returning its payload or throwing if invalid. */
export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.jwt.accessSecret) as AccessTokenPayload;
}

/**
 * Generate an opaque refresh token (256 bits of entropy) and its SHA-256 hash.
 * The raw value goes to the client cookie; only the hash is stored (D-3).
 */
export function generateRefreshToken(): { token: string; tokenHash: string } {
  const token = crypto.randomBytes(32).toString('hex');
  return { token, tokenHash: hashToken(token) };
}

/** Deterministic SHA-256 hash — used to look up / compare refresh tokens. */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/** Refresh-token lifetime in milliseconds (parsed from env, default 7d). */
export function refreshTokenTtlMs(): number {
  return parseDuration(env.jwt.refreshTtl, 7 * 24 * 60 * 60 * 1000);
}

/** Minimal duration parser supporting `s`, `m`, `h`, `d` suffixes. */
function parseDuration(value: string, fallbackMs: number): number {
  const match = /^(\d+)([smhd])$/.exec(value.trim());
  if (!match) return fallbackMs;
  const amount = Number(match[1]);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  return amount * multipliers[unit];
}
