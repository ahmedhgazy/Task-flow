import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpResponse, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { tap, of, catchError, throwError } from 'rxjs';
import { CacheService } from '../services/cache.service';

/**
 * HTTP Cache Interceptor
 * 
 * Caches GET responses and serves from cache when available.
 * Automatically invalidates cache on PUT/POST/DELETE/PATCH requests.
 */

interface CacheableConfig {
  cacheable: boolean;
  ttlMs?: number;
  persistToStorage?: boolean;
  tags?: string[];
  invalidatePattern?: string;
}

// Cache configuration per endpoint pattern
const CACHE_CONFIG: Record<string, CacheableConfig> = {
  // Boards - cacheable
  'GET /boards$': { cacheable: true, ttlMs: 5 * 60 * 1000, tags: ['boards'] },
  'GET /boards/[^/]+$': { cacheable: true, ttlMs: 2 * 60 * 1000, tags: ['boards'] },
  'GET /boards/workspace/[^/]+$': { cacheable: true, ttlMs: 5 * 60 * 1000, tags: ['boards'] },
  
  // Workspaces - cacheable
  'GET /workspaces$': { cacheable: true, ttlMs: 10 * 60 * 1000, tags: ['workspaces'], persistToStorage: true },
  'GET /workspaces/[^/]+$': { cacheable: true, ttlMs: 10 * 60 * 1000, tags: ['workspaces'] },
  'GET /workspaces/[^/]+/members$': { cacheable: true, ttlMs: 5 * 60 * 1000, tags: ['members'] },
  
  // Cards - short TTL due to frequent updates
  'GET /boards/cards/[^/]+$': { cacheable: true, ttlMs: 30 * 1000, tags: ['cards'] },
  
  // Sprints
  'GET /sprints$': { cacheable: true, ttlMs: 5 * 60 * 1000, tags: ['sprints'] },
  'GET /sprints/board/[^/]+$': { cacheable: true, ttlMs: 5 * 60 * 1000, tags: ['sprints'] },
  
  // Invitations
  'GET /workspaces/invitations$': { cacheable: true, ttlMs: 60 * 1000, tags: ['invitations'] },
  
  // Non-cacheable endpoints
  'GET /auth/': { cacheable: false },
  'POST /': { cacheable: false },
  'PUT /': { cacheable: false },
  'DELETE /': { cacheable: false },
  'PATCH /': { cacheable: false },
};

// Invalidation rules - which patterns to invalidate on mutation
const INVALIDATION_RULES: Record<string, string[]> = {
  // Board mutations invalidate board caches
  'POST /boards': ['boards', 'workspaces'],
  'PUT /boards/[^/]+$': ['boards'],
  'DELETE /boards/[^/]+$': ['boards', 'workspaces'],
  'POST /boards/[^/]+/archive': ['boards', 'workspaces'],
  
  // List mutations invalidate board detail
  'POST /boards/[^/]+/lists': ['boards'],
  'PUT /boards/lists/[^/]+$': ['boards'],
  'DELETE /boards/lists/[^/]+$': ['boards'],
  'POST /boards/lists/[^/]+/move': ['boards'],
  'POST /boards/lists/[^/]+/archive': ['boards'],
  
  // Card mutations invalidate board and card caches
  'POST /boards/lists/[^/]+/cards': ['boards', 'cards'],
  'PUT /boards/cards/[^/]+$': ['boards', 'cards'],
  'DELETE /boards/cards/[^/]+$': ['boards', 'cards'],
  'POST /boards/cards/[^/]+/move': ['boards', 'cards'],
  'POST /boards/cards/[^/]+/archive': ['boards', 'cards'],
  'POST /boards/cards/[^/]+/lock': ['cards'],
  'POST /boards/cards/[^/]+/unlock': ['cards'],
  'POST /boards/cards/[^/]+/assign': ['cards'],
  'DELETE /boards/cards/[^/]+/assign': ['cards'],
  'POST /boards/cards/[^/]+/labels': ['cards'],
  'DELETE /boards/cards/[^/]+/labels': ['cards'],
  
  // Workspace mutations
  'POST /workspaces': ['workspaces'],
  'PUT /workspaces/[^/]+$': ['workspaces'],
  'DELETE /workspaces/[^/]+$': ['workspaces'],
  'POST /workspaces/[^/]+/invite': ['invitations'],
  'DELETE /workspaces/[^/]+/members': ['members', 'workspaces'],
  
  // Sprint mutations
  'POST /sprints': ['sprints', 'boards'],
  'PUT /sprints/[^/]+$': ['sprints'],
  'DELETE /sprints/[^/]+$': ['sprints', 'boards'],
  'POST /sprints/[^/]+/complete': ['sprints', 'boards'],
};

export const cacheInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn) => {
  const cacheService = inject(CacheService);
  
  // Only cache GET requests
  if (req.method !== 'GET') {
    // Handle cache invalidation for mutations
    handleInvalidation(req, cacheService);
    return next(req);
  }
  
  // Find matching cache config
  const config = findCacheConfig(req);
  
  if (!config?.cacheable) {
    return next(req);
  }
  
  const cacheKey = generateCacheKey(req);
  
  // Try to get from cache
  const cachedResponse = cacheService.get<HttpResponse<unknown>>(cacheKey);
  
  if (cachedResponse) {
    // Return cached response as observable
    return of(cachedResponse as HttpResponse<unknown>);
  }
  
  // Not in cache, make the request
  return next(req).pipe(
    tap((event) => {
      if (event instanceof HttpResponse) {
        // Cache the response
        cacheService.set(cacheKey, event, {
          ttlMs: config.ttlMs,
          persistToStorage: config.persistToStorage,
          tags: config.tags
        });
      }
    }),
    catchError((error: HttpErrorResponse) => {
      // Don't cache errors
      return throwError(() => error);
    })
  );
};

/**
 * Generate a unique cache key for the request
 */
function generateCacheKey(req: HttpRequest<unknown>): string {
  const url = req.urlWithParams;
  // Include auth user context in key if available
  const authHeader = req.headers.get('Authorization');
  const userHash = authHeader ? hashString(authHeader.slice(-20)) : 'anon';
  return `${url}:${userHash}`;
}

/**
 * Find cache configuration for the request
 */
function findCacheConfig(req: HttpRequest<unknown>): CacheableConfig | null {
  const method = req.method;
  const url = req.url;
  const pattern = `${method} ${url}`;
  
  // Check each pattern in config
  for (const [key, config] of Object.entries(CACHE_CONFIG)) {
    const regex = new RegExp(`^${key.replace(/\//g, '\\/')}$`);
    if (regex.test(pattern)) {
      return config;
    }
  }
  
  // Default: not cacheable
  return null;
}

/**
 * Handle cache invalidation for mutation requests
 */
function handleInvalidation(req: HttpRequest<unknown>, cacheService: CacheService): void {
  const method = req.method;
  const url = req.url;
  const pattern = `${method} ${url}`;
  
  // Find matching invalidation rules
  for (const [rulePattern, tags] of Object.entries(INVALIDATION_RULES)) {
    const regex = new RegExp(`^${rulePattern.replace(/\//g, '\\/')}$`);
    if (regex.test(pattern)) {
      cacheService.invalidateTags(tags);
      return;
    }
  }
  
  // Fallback: invalidate by URL pattern
  // Extract resource type from URL
  const resourceMatch = url.match(/\/(boards|workspaces|cards|sprints|lists)/);
  if (resourceMatch) {
    const resource = resourceMatch[1];
    cacheService.invalidatePattern(resource);
  }
}

/**
 * Simple string hash for cache key uniqueness
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(36);
}
