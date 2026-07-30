/**
 * Tiny in-memory TTL cache (Session 6). Similar-property results are read-heavy
 * and change rarely, so a short-lived cache removes repeat DB work. Swap for
 * Redis if the API is scaled to multiple instances (a per-process cache is not
 * shared across instances).
 */
interface Entry<T> {
  value: T;
  expiresAt: number;
}

export class TTLCache<T> {
  private store = new Map<string, Entry<T>>();

  constructor(
    private ttlMs: number,
    private maxEntries = 1000,
  ) {}

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T): void {
    // Simple bound: drop the oldest entry when full.
    if (this.store.size >= this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) this.store.delete(oldest);
    }
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  delete(key: string): void {
    this.store.delete(key);
  }
}
