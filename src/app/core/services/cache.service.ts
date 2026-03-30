import { Injectable, signal, computed } from '@angular/core';

/**
 * Multi-layer cache service for Angular applications
 * - L1: In-memory cache (fastest, session-scoped)
 * - L2: LocalStorage cache (persistent across sessions)
 */

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
  etag?: string;
}

export interface CacheOptions {
  ttlMs?: number;           // Time to live in milliseconds
  persistToStorage?: boolean; // Save to localStorage
  tags?: string[];          // Tags for batch invalidation
}

@Injectable({ providedIn: 'root' })
export class CacheService {
  // Default TTL values for different data types
  private readonly DEFAULT_TTL = {
    boards: 5 * 60 * 1000,      // 5 minutes
    workspaces: 10 * 60 * 1000, // 10 minutes
    cards: 2 * 60 * 1000,       // 2 minutes (frequently updated)
    user: 30 * 60 * 1000,       // 30 minutes
    static: 60 * 60 * 1000,     // 1 hour (rarely changes)
  };

  // In-memory cache (L1)
  private memoryCache = new Map<string, CacheEntry<unknown>>();
  
  // Tag index for batch invalidation
  private tagIndex = new Map<string, Set<string>>();

  // Reactive cache statistics
  readonly stats = signal({
    hits: 0,
    misses: 0,
    memorySize: 0,
    storageSize: 0
  });

  // Computed hit rate
  readonly hitRate = computed(() => {
    const { hits, misses } = this.stats();
    const total = hits + misses;
    return total > 0 ? (hits / total) * 100 : 0;
  });

  constructor() {
    this.cleanupExpiredEntries();
    this.loadFromStorage();
  }

  /**
   * Get value from cache
   */
  get<T>(key: string): T | null {
    // Try L1 (memory) first
    const memoryEntry = this.memoryCache.get(key) as CacheEntry<T> | undefined;
    if (memoryEntry && !this.isExpired(memoryEntry)) {
      this.stats.update(s => ({ ...s, hits: s.hits + 1 }));
      return memoryEntry.data;
    }

    // Try L2 (localStorage)
    const storageEntry = this.getFromStorage<T>(key);
    if (storageEntry && !this.isExpired(storageEntry)) {
      // Promote to L1
      this.memoryCache.set(key, storageEntry);
      this.stats.update(s => ({ ...s, hits: s.hits + 1 }));
      return storageEntry.data;
    }

    this.stats.update(s => ({ ...s, misses: s.misses + 1 }));
    return null;
  }

  /**
   * Set value in cache
   */
  set<T>(key: string, data: T, options: CacheOptions = {}): void {
    const ttl = options.ttlMs ?? this.getTTLForType(key);
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttl
    };

    // Store in L1 (memory)
    this.memoryCache.set(key, entry as CacheEntry<unknown>);
    this.stats.update(s => ({ ...s, memorySize: this.memoryCache.size }));

    // Store in L2 (localStorage) if persistent
    if (options.persistToStorage) {
      this.saveToStorage(key, entry);
    }

    // Index by tags
    if (options.tags) {
      for (const tag of options.tags) {
        if (!this.tagIndex.has(tag)) {
          this.tagIndex.set(tag, new Set());
        }
        this.tagIndex.get(tag)!.add(key);
      }
    }
  }

  /**
   * Check if entry exists and is valid
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Delete entry from cache
   */
  delete(key: string): void {
    this.memoryCache.delete(key);
    this.removeFromStorage(key);
    this.stats.update(s => ({ ...s, memorySize: this.memoryCache.size }));
  }

  /**
   * Invalidate all entries with a specific tag
   */
  invalidateTag(tag: string): void {
    const keys = this.tagIndex.get(tag);
    if (keys) {
      for (const key of keys) {
        this.delete(key);
      }
      this.tagIndex.delete(tag);
    }
  }

  /**
   * Invalidate multiple tags
   */
  invalidateTags(tags: string[]): void {
    for (const tag of tags) {
      this.invalidateTag(tag);
    }
  }

  /**
   * Invalidate by key pattern
   */
  invalidatePattern(pattern: string): void {
    const regex = new RegExp(pattern);
    
    // Invalidate from memory cache
    for (const key of this.memoryCache.keys()) {
      if (regex.test(key)) {
        this.delete(key);
      }
    }

    // Invalidate from localStorage
    this.invalidateStoragePattern(pattern);
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.memoryCache.clear();
    this.clearStorage();
    this.tagIndex.clear();
    this.stats.update(s => ({ ...s, memorySize: 0, storageSize: 0 }));
  }

  /**
   * Get or set - returns cached value or executes factory
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const data = await factory();
    this.set(key, data, options);
    return data;
  }

  /**
   * Update existing entry without changing expiration
   */
  update<T>(key: string, data: T): void {
    const existing = this.memoryCache.get(key) as CacheEntry<T> | undefined;
    if (existing) {
      existing.data = data;
      existing.timestamp = Date.now();
      this.memoryCache.set(key, existing as CacheEntry<unknown>);
    }
  }

  // Private methods

  private isExpired(entry: CacheEntry<unknown>): boolean {
    return Date.now() > entry.expiresAt;
  }

  private getTTLForType(key: string): number {
    if (key.includes('board')) return this.DEFAULT_TTL.boards;
    if (key.includes('workspace')) return this.DEFAULT_TTL.workspaces;
    if (key.includes('card')) return this.DEFAULT_TTL.cards;
    if (key.includes('user')) return this.DEFAULT_TTL.user;
    return this.DEFAULT_TTL.static;
  }

  private getStorageKey(key: string): string {
    return `tf_cache_${key}`;
  }

  private getFromStorage<T>(key: string): CacheEntry<T> | null {
    try {
      const storageKey = this.getStorageKey(key);
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        return JSON.parse(raw) as CacheEntry<T>;
      }
    } catch (error) {
      console.warn('Cache read from storage failed:', error);
    }
    return null;
  }

  private saveToStorage<T>(key: string, entry: CacheEntry<T>): void {
    try {
      const storageKey = this.getStorageKey(key);
      localStorage.setItem(storageKey, JSON.stringify(entry));
    } catch (error) {
      console.warn('Cache write to storage failed:', error);
      // Storage might be full, try cleanup
      this.cleanupStorage();
    }
  }

  private removeFromStorage(key: string): void {
    try {
      const storageKey = this.getStorageKey(key);
      localStorage.removeItem(storageKey);
    } catch (error) {
      console.warn('Cache remove from storage failed:', error);
    }
  }

  private invalidateStoragePattern(pattern: string): void {
    try {
      const regex = new RegExp(pattern);
      const prefix = 'tf_cache_';
      const keysToRemove: string[] = [];

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(prefix)) {
          const cacheKey = key.slice(prefix.length);
          if (regex.test(cacheKey)) {
            keysToRemove.push(key);
          }
        }
      }

      for (const key of keysToRemove) {
        localStorage.removeItem(key);
      }
    } catch (error) {
      console.warn('Cache pattern invalidation failed:', error);
    }
  }

  private clearStorage(): void {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('tf_cache_')) {
          keysToRemove.push(key);
        }
      }
      for (const key of keysToRemove) {
        localStorage.removeItem(key);
      }
    } catch (error) {
      console.warn('Cache clear storage failed:', error);
    }
  }

  private loadFromStorage(): void {
    try {
      const prefix = 'tf_cache_';
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(prefix)) {
          const cacheKey = key.slice(prefix.length);
          const entry = this.getFromStorage(cacheKey);
          if (entry && !this.isExpired(entry)) {
            this.memoryCache.set(cacheKey, entry);
          }
        }
      }
      this.stats.update(s => ({ ...s, memorySize: this.memoryCache.size }));
    } catch (error) {
      console.warn('Cache load from storage failed:', error);
    }
  }

  private cleanupExpiredEntries(): void {
    // Run cleanup every 5 minutes
    setInterval(() => {
      let cleaned = 0;
      
      // Cleanup memory cache
      for (const [key, entry] of this.memoryCache.entries()) {
        if (this.isExpired(entry)) {
          this.memoryCache.delete(key);
          cleaned++;
        }
      }

      // Cleanup localStorage
      this.cleanupStorage();

      if (cleaned > 0) {
        this.stats.update(s => ({ ...s, memorySize: this.memoryCache.size }));
      }
    }, 5 * 60 * 1000);
  }

  private cleanupStorage(): void {
    try {
      const prefix = 'tf_cache_';
      const keysToRemove: string[] = [];

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(prefix)) {
          const raw = localStorage.getItem(key);
          if (raw) {
            try {
              const entry = JSON.parse(raw) as CacheEntry<unknown>;
              if (this.isExpired(entry)) {
                keysToRemove.push(key);
              }
            } catch {
              keysToRemove.push(key);
            }
          }
        }
      }

      for (const key of keysToRemove) {
        localStorage.removeItem(key);
      }
    } catch (error) {
      console.warn('Storage cleanup failed:', error);
    }
  }
}
