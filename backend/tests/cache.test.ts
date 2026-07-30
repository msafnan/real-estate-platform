import assert from 'node:assert';
import { describe, it } from 'node:test';
import { setTimeout as sleep } from 'node:timers/promises';
import { TTLCache } from '../src/utils/cache';

describe('TTLCache', () => {
  it('stores and returns a value', () => {
    const c = new TTLCache<number>(1000);
    c.set('a', 42);
    assert.strictEqual(c.get('a'), 42);
  });

  it('expires entries after the TTL', async () => {
    const c = new TTLCache<string>(20);
    c.set('k', 'v');
    assert.strictEqual(c.get('k'), 'v');
    await sleep(35);
    assert.strictEqual(c.get('k'), undefined);
  });

  it('evicts the oldest entry when full', () => {
    const c = new TTLCache<number>(1000, 2);
    c.set('a', 1);
    c.set('b', 2);
    c.set('c', 3); // should evict 'a'
    assert.strictEqual(c.get('a'), undefined);
    assert.strictEqual(c.get('b'), 2);
    assert.strictEqual(c.get('c'), 3);
  });

  it('delete removes an entry', () => {
    const c = new TTLCache<number>(1000);
    c.set('a', 1);
    c.delete('a');
    assert.strictEqual(c.get('a'), undefined);
  });
});
