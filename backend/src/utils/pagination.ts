/**
 * Cursor-based (keyset) pagination helpers (D-5). Reused by property list
 * (Session 4) and search (Session 5).
 *
 * The cursor is an opaque base64 token encoding the last row's
 * (createdAt, id) — the tuple we order by. Keyset avoids OFFSET's linear scan
 * cost at 50k+ rows.
 */
export interface Cursor {
  createdAt: Date;
  id: string;
}

export function encodeCursor(row: { createdAt: Date; id: string }): string {
  const raw = `${row.createdAt.toISOString()}|${row.id}`;
  return Buffer.from(raw, 'utf8').toString('base64url');
}

export function decodeCursor(token: string): Cursor | null {
  try {
    const raw = Buffer.from(token, 'base64url').toString('utf8');
    const [iso, id] = raw.split('|');
    const createdAt = new Date(iso);
    if (!id || Number.isNaN(createdAt.getTime())) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}

/**
 * Prisma `where` fragment for "strictly after this cursor" under a
 * `createdAt DESC, id DESC` ordering. Returns `undefined` for the first page.
 */
export function keysetWhere(cursor: Cursor | null) {
  if (!cursor) return undefined;
  return {
    OR: [
      { createdAt: { lt: cursor.createdAt } },
      { createdAt: cursor.createdAt, id: { lt: cursor.id } },
    ],
  };
}
