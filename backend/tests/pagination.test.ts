import assert from 'node:assert';
import { describe, it } from 'node:test';
import { decodeCursor, encodeCursor, keysetWhere } from '../src/utils/pagination';

describe('cursor pagination', () => {
  it('round-trips a cursor (id + createdAt to ms)', () => {
    const row = { id: 'abc-123', createdAt: new Date('2026-01-02T03:04:05.678Z') };
    const token = encodeCursor(row);
    const decoded = decodeCursor(token);
    assert.ok(decoded);
    assert.strictEqual(decoded!.id, 'abc-123');
    assert.strictEqual(decoded!.createdAt.toISOString(), row.createdAt.toISOString());
  });

  it('produces an opaque (non-plaintext) token', () => {
    const token = encodeCursor({ id: 'abc-123', createdAt: new Date() });
    assert.ok(!token.includes('abc-123'));
  });

  it('returns null for a malformed cursor', () => {
    assert.strictEqual(decodeCursor('not-a-real-cursor'), null);
  });

  it('keysetWhere is undefined without a cursor (first page)', () => {
    assert.strictEqual(keysetWhere(null), undefined);
  });

  it('keysetWhere builds a strict "after" predicate', () => {
    const cur = { id: 'x', createdAt: new Date('2026-01-01T00:00:00.000Z') };
    const where = keysetWhere(cur) as { OR: unknown[] };
    assert.strictEqual(where.OR.length, 2);
    // First branch: strictly older createdAt.
    assert.deepStrictEqual(where.OR[0], { createdAt: { lt: cur.createdAt } });
    // Second branch: same createdAt, smaller id (tiebreak).
    assert.deepStrictEqual(where.OR[1], { createdAt: cur.createdAt, id: { lt: 'x' } });
  });
});
