import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, shareReplay, finalize } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Workspace, WorkspaceMember, WorkspaceInvitation } from '../models/board.model';
import { CacheService } from './cache.service';

/**
 * Workspace service with integrated caching
 */
@Injectable({ providedIn: 'root' })
export class WorkspaceCachedService {
  private baseUrl = `${environment.apiUrl}/workspaces`;

  // Reactive state
  private workspacesSignal = signal<Workspace[]>([]);
  private currentWorkspaceSignal = signal<Workspace | null>(null);
  private loadingSignal = signal(false);
  private errorSignal = signal<string | null>(null);

  // Public readonly signals
  readonly workspaces = this.workspacesSignal.asReadonly();
  readonly currentWorkspace = this.currentWorkspaceSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();

  // Computed
  readonly workspaceCount = computed(() => this.workspaces().length);

  private pendingRequests = new Map<string, Observable<unknown>>();

  constructor(
    private http: HttpClient,
    private cache: CacheService
  ) {}

  /**
   * Get all workspaces for current user
   */
  getWorkspaces(forceRefresh = false): Observable<Workspace[]> {
    const cacheKey = this.baseUrl;
    
    if (!forceRefresh) {
      const cached = this.cache.get<Workspace[]>(cacheKey);
      if (cached) {
        this.workspacesSignal.set(cached);
        return new Observable(observer => {
          observer.next(cached);
          observer.complete();
        });
      }
    }

    if (this.pendingRequests.has(cacheKey)) {
      return this.pendingRequests.get(cacheKey) as Observable<Workspace[]>;
    }

    this.loadingSignal.set(true);

    const request = this.http.get<Workspace[]>(this.baseUrl).pipe(
      tap(workspaces => {
        this.workspacesSignal.set(workspaces);
        this.cache.set(cacheKey, workspaces, { 
          ttlMs: 10 * 60 * 1000, 
          tags: ['workspaces'],
          persistToStorage: true
        });
      }),
      shareReplay(1),
      finalize(() => {
        this.loadingSignal.set(false);
        this.pendingRequests.delete(cacheKey);
      })
    );

    this.pendingRequests.set(cacheKey, request);
    return request;
  }

  /**
   * Get single workspace
   */
  getWorkspace(id: string, forceRefresh = false): Observable<Workspace> {
    const cacheKey = `${this.baseUrl}/${id}`;
    
    if (!forceRefresh) {
      const cached = this.cache.get<Workspace>(cacheKey);
      if (cached) {
        this.currentWorkspaceSignal.set(cached);
        return new Observable(observer => {
          observer.next(cached);
          observer.complete();
        });
      }
    }

    if (this.pendingRequests.has(cacheKey)) {
      return this.pendingRequests.get(cacheKey) as Observable<Workspace>;
    }

    this.loadingSignal.set(true);

    const request = this.http.get<Workspace>(`${this.baseUrl}/${id}`).pipe(
      tap(workspace => {
        this.currentWorkspaceSignal.set(workspace);
        this.cache.set(cacheKey, workspace, { 
          ttlMs: 10 * 60 * 1000, 
          tags: ['workspaces', `workspace-${id}`] 
        });
      }),
      shareReplay(1),
      finalize(() => {
        this.loadingSignal.set(false);
        this.pendingRequests.delete(cacheKey);
      })
    );

    this.pendingRequests.set(cacheKey, request);
    return request;
  }

  /**
   * Create workspace
   */
  createWorkspace(data: { name: string; description?: string }): Observable<Workspace> {
    this.loadingSignal.set(true);

    return this.http.post<Workspace>(this.baseUrl, data).pipe(
      tap({
        next: (newWorkspace) => {
          this.workspacesSignal.update(workspaces => [...workspaces, newWorkspace]);
          this.cache.invalidateTags(['workspaces']);
        },
        error: (error) => this.errorSignal.set(error.message)
      }),
      finalize(() => this.loadingSignal.set(false))
    );
  }

  /**
   * Update workspace
   */
  updateWorkspace(id: string, data: { name: string; description?: string; logoUrl?: string }): Observable<Workspace> {
    // Optimistic update
    const previous = this.currentWorkspaceSignal();
    if (previous && previous.id === id) {
      this.currentWorkspaceSignal.set({ ...previous, ...data });
    }

    return this.http.put<Workspace>(`${this.baseUrl}/${id}`, data).pipe(
      tap({
        next: (updated) => {
          this.workspacesSignal.update(workspaces => 
            workspaces.map(w => w.id === id ? updated : w)
          );
          this.currentWorkspaceSignal.set(updated);
          this.cache.set(`${this.baseUrl}/${id}`, updated, {
            ttlMs: 10 * 60 * 1000,
            tags: ['workspaces']
          });
        },
        error: () => {
          if (previous) this.currentWorkspaceSignal.set(previous);
        }
      })
    );
  }

  /**
   * Delete workspace
   */
  deleteWorkspace(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`).pipe(
      tap(() => {
        this.workspacesSignal.update(workspaces => 
          workspaces.filter(w => w.id !== id)
        );
        this.cache.invalidateTags(['workspaces']);
        this.cache.delete(`${this.baseUrl}/${id}`);
      })
    );
  }

  /**
   * Get workspace members
   */
  getMembers(workspaceId: string): Observable<WorkspaceMember[]> {
    const cacheKey = `${this.baseUrl}/${workspaceId}/members`;
    
    const cached = this.cache.get<WorkspaceMember[]>(cacheKey);
    if (cached) {
      return new Observable(observer => {
        observer.next(cached);
        observer.complete();
      });
    }

    return this.http.get<WorkspaceMember[]>(`${this.baseUrl}/${workspaceId}/members`).pipe(
      tap(members => {
        this.cache.set(cacheKey, members, { 
          ttlMs: 5 * 60 * 1000, 
          tags: ['members', `workspace-${workspaceId}`] 
        });
      })
    );
  }

  /**
   * Invite member
   */
  inviteMember(workspaceId: string, email: string, role: string = 'Member'): Observable<{ message: string; token: string }> {
    return this.http.post<{ message: string; token: string }>(`${this.baseUrl}/${workspaceId}/invite`, { email, role }).pipe(
      tap(() => {
        this.cache.invalidateTags(['invitations']);
      })
    );
  }

  /**
   * Accept invitation
   */
  acceptInvitation(token: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/accept-invitation`, { token }).pipe(
      tap(() => {
        this.cache.invalidateTags(['workspaces', 'invitations']);
      })
    );
  }

  /**
   * Remove member
   */
  removeMember(workspaceId: string, userId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${workspaceId}/members/${userId}`).pipe(
      tap(() => {
        this.cache.invalidateTags(['members', `workspace-${workspaceId}`]);
      })
    );
  }

  /**
   * Get my invitations
   */
  getMyInvitations(): Observable<WorkspaceInvitation[]> {
    const cacheKey = `${this.baseUrl}/invitations`;
    
    const cached = this.cache.get<WorkspaceInvitation[]>(cacheKey);
    if (cached) {
      return new Observable(observer => {
        observer.next(cached);
        observer.complete();
      });
    }

    return this.http.get<WorkspaceInvitation[]>(`${this.baseUrl}/invitations`).pipe(
      tap(invitations => {
        this.cache.set(cacheKey, invitations, { 
          ttlMs: 60 * 1000, 
          tags: ['invitations'] 
        });
      })
    );
  }

  /**
   * Reject invitation
   */
  rejectInvitation(token: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/invitations/${token}/reject`, {}).pipe(
      tap(() => {
        this.cache.invalidateTags(['invitations']);
      })
    );
  }

  /**
   * Refresh workspaces
   */
  refreshWorkspaces(): Observable<Workspace[]> {
    return this.getWorkspaces(true);
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.invalidateTags(['workspaces', 'members', 'invitations']);
    this.workspacesSignal.set([]);
    this.currentWorkspaceSignal.set(null);
  }
}
