import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, shareReplay, finalize } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Board, BoardDetail, BoardList, Card, CardPriority, CardType } from '../models/board.model';
import { CacheService } from './cache.service';

/**
 * Board service with integrated caching
 * 
 * Features:
 * - Automatic HTTP caching via interceptor
 * - Signal-based reactive state
 * - Optimistic updates with rollback
 * - Request deduplication
 */
@Injectable({ providedIn: 'root' })
export class BoardService {
  private baseUrl = `${environment.apiUrl}/boards`;

  // Reactive state using signals
  private boardsSignal = signal<Board[]>([]);
  private currentBoardSignal = signal<BoardDetail | null>(null);
  private loadingSignal = signal(false);
  private errorSignal = signal<string | null>(null);

  // Public readonly signals
  readonly boards = this.boardsSignal.asReadonly();
  readonly currentBoard = this.currentBoardSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();

  // Computed signals
  readonly activeBoards = computed(() => 
    this.boards().filter(b => !b.isArchived)
  );

  readonly boardCount = computed(() => this.boards().length);

  // Pending requests for deduplication
  private pendingRequests = new Map<string, Observable<unknown>>();

  constructor(
    private http: HttpClient,
    private cache: CacheService
  ) {}

  // ==================== BOARDS ====================

  /**
   * Get all boards for current user
   * Uses caching and request deduplication
   */
  getBoards(): Observable<Board[]> {
    const cacheKey = `${this.baseUrl}`;
    
    // Check cache first
    const cached = this.cache.get<Board[]>(cacheKey);
    if (cached) {
      this.boardsSignal.set(cached);
      return new Observable(observer => {
        observer.next(cached);
        observer.complete();
      });
    }

    // Deduplicate concurrent requests
    if (this.pendingRequests.has(cacheKey)) {
      return this.pendingRequests.get(cacheKey) as Observable<Board[]>;
    }

    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    const request = this.http.get<Board[]>(this.baseUrl).pipe(
      tap({
        next: (boards) => {
          this.boardsSignal.set(boards);
          this.cache.set(cacheKey, boards, { 
            ttlMs: 5 * 60 * 1000, 
            tags: ['boards'] 
          });
        },
        error: (error) => this.errorSignal.set(error.message)
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
   * Get boards for a workspace
   */
  getWorkspaceBoards(workspaceId: string): Observable<Board[]> {
    const cacheKey = `${this.baseUrl}/workspace/${workspaceId}`;
    
    const cached = this.cache.get<Board[]>(cacheKey);
    if (cached) {
      return new Observable(observer => {
        observer.next(cached);
        observer.complete();
      });
    }

    if (this.pendingRequests.has(cacheKey)) {
      return this.pendingRequests.get(cacheKey) as Observable<Board[]>;
    }

    const request = this.http.get<Board[]>(`${this.baseUrl}/workspace/${workspaceId}`).pipe(
      tap(boards => {
        this.cache.set(cacheKey, boards, { 
          ttlMs: 5 * 60 * 1000, 
          tags: ['boards', `workspace-${workspaceId}`] 
        });
      }),
      shareReplay(1),
      finalize(() => this.pendingRequests.delete(cacheKey))
    );

    this.pendingRequests.set(cacheKey, request);
    return request;
  }

  /**
   * Get single board with full details
   */
  getBoard(boardId: string, forceRefresh = false): Observable<BoardDetail> {
    const cacheKey = `${this.baseUrl}/${boardId}`;
    
    if (!forceRefresh) {
      const cached = this.cache.get<BoardDetail>(cacheKey);
      if (cached) {
        this.currentBoardSignal.set(cached);
        return new Observable(observer => {
          observer.next(cached);
          observer.complete();
        });
      }
    }

    if (this.pendingRequests.has(cacheKey)) {
      return this.pendingRequests.get(cacheKey) as Observable<BoardDetail>;
    }

    this.loadingSignal.set(true);

    const request = this.http.get<BoardDetail>(`${this.baseUrl}/${boardId}`).pipe(
      tap(board => {
        this.currentBoardSignal.set(board);
        this.cache.set(cacheKey, board, { 
          ttlMs: 2 * 60 * 1000, 
          tags: ['boards', `board-${boardId}`] 
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
   * Create a new board
   */
  createBoard(workspaceId: string, data: { name: string; description?: string; backgroundColor?: string }): Observable<Board> {
    this.loadingSignal.set(true);
    
    return this.http.post<Board>(`${this.baseUrl}/workspace/${workspaceId}`, data).pipe(
      tap({
        next: (newBoard) => {
          // Optimistic update: add to local state
          this.boardsSignal.update(boards => [...boards, newBoard]);
          
          // Invalidate related caches
          this.cache.invalidateTags(['boards']);
          this.cache.invalidatePattern(`workspace-${workspaceId}`);
        },
        error: (error) => this.errorSignal.set(error.message)
      }),
      finalize(() => this.loadingSignal.set(false))
    );
  }

  /**
   * Update a board
   */
  updateBoard(boardId: string, data: { name: string; description?: string; backgroundColor?: string }): Observable<Board> {
    // Optimistic update
    const previousBoard = this.currentBoardSignal();
    if (previousBoard && previousBoard.id === boardId) {
      this.currentBoardSignal.set({
        ...previousBoard,
        name: data.name,
        description: data.description
      });
    }

    return this.http.put<Board>(`${this.baseUrl}/${boardId}`, data).pipe(
      tap({
        next: (updatedBoard) => {
          // Update local state (Board list)
          this.boardsSignal.update(boards => 
            boards.map(b => b.id === boardId ? { ...b, name: updatedBoard.name, description: updatedBoard.description } : b)
          );
          
          // Update current board detail if loaded
          const currentBoard = this.currentBoardSignal();
          if (currentBoard && currentBoard.id === boardId) {
            this.currentBoardSignal.set({
              ...currentBoard,
              name: updatedBoard.name,
              description: updatedBoard.description
            });
          }
          
          // Update cache
          this.cache.set(`${this.baseUrl}/${boardId}`, updatedBoard, { 
            ttlMs: 2 * 60 * 1000, 
            tags: ['boards', `board-${boardId}`] 
          });
        },
        error: () => {
          // Rollback on error
          if (previousBoard) {
            this.currentBoardSignal.set(previousBoard);
          }
        }
      })
    );
  }

  /**
   * Archive a board
   */
  archiveBoard(boardId: string): Observable<void> {
    // Optimistic update
    this.boardsSignal.update(boards => 
      boards.filter(b => b.id !== boardId)
    );

    return this.http.post<void>(`${this.baseUrl}/${boardId}/archive`, {}).pipe(
      tap({
        next: () => {
          this.cache.invalidateTags(['boards']);
          this.cache.delete(`${this.baseUrl}/${boardId}`);
        },
        error: () => {
          // Force refresh on error
          this.getBoards().subscribe();
        }
      })
    );
  }

  /**
   * Delete a board permanently
   */
  deleteBoard(boardId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${boardId}`).pipe(
      tap({
        next: () => {
          this.boardsSignal.update(boards => 
            boards.filter(b => b.id !== boardId)
          );
          this.cache.invalidateTags(['boards']);
          this.cache.delete(`${this.baseUrl}/${boardId}`);
        }
      })
    );
  }

  // ==================== LISTS ====================

  createList(boardId: string, data: { name: string; rank?: number }): Observable<BoardList> {
    return this.http.post<BoardList>(`${this.baseUrl}/${boardId}/lists`, data).pipe(
      tap(newList => {
        // Update current board if loaded
        this.currentBoardSignal.update(board => {
          if (board && board.id === boardId) {
            return { ...board, lists: [...board.lists, newList] };
          }
          return board;
        });
        
        // Invalidate board cache
        this.cache.invalidateTags([`board-${boardId}`]);
      })
    );
  }

  updateList(listId: string, data: { name: string }): Observable<BoardList> {
    return this.http.put<BoardList>(`${this.baseUrl}/lists/${listId}`, data).pipe(
      tap(updatedList => {
        this.currentBoardSignal.update(board => {
          if (board) {
            return {
              ...board,
              lists: board.lists.map(l => l.id === listId ? updatedList : l)
            };
          }
          return board;
        });
      })
    );
  }

  moveList(listId: string, newRank: number): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/lists/${listId}/move`, { newRank });
  }

  archiveList(listId: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/lists/${listId}/archive`, {}).pipe(
      tap(() => {
        this.currentBoardSignal.update(board => {
          if (board) {
            return {
              ...board,
              lists: board.lists.filter(l => l.id !== listId)
            };
          }
          return board;
        });
      })
    );
  }

  deleteList(listId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/lists/${listId}`);
  }

  // ==================== CARDS ====================

  createCard(listId: string, data: {
    title: string; description?: string; priority?: CardPriority;
    type?: CardType; storyPoints?: number; estimatedHours?: number;
    dueDate?: Date; sprintId?: string; epicId?: string;
  }): Observable<Card> {
    return this.http.post<Card>(`${this.baseUrl}/lists/${listId}/cards`, data).pipe(
      tap(newCard => {
        this.currentBoardSignal.update(board => {
          if (board) {
            return {
              ...board,
              lists: board.lists.map(l => 
                l.id === listId 
                  ? { ...l, cards: [...l.cards, newCard] }
                  : l
              )
            };
          }
          return board;
        });
      })
    );
  }

  getCard(cardId: string): Observable<Card> {
    const cacheKey = `${this.baseUrl}/cards/${cardId}`;
    
    const cached = this.cache.get<Card>(cacheKey);
    if (cached) {
      return new Observable(observer => {
        observer.next(cached);
        observer.complete();
      });
    }

    return this.http.get<Card>(`${this.baseUrl}/cards/${cardId}`).pipe(
      tap(card => {
        this.cache.set(cacheKey, card, { 
          ttlMs: 30 * 1000, 
          tags: ['cards', `card-${cardId}`] 
        });
      })
    );
  }

  updateCard(cardId: string, data: {
    title: string; description?: string; priority: CardPriority;
    type: CardType; storyPoints?: number; estimatedHours?: number;
    dueDate?: Date; sprintId?: string; epicId?: string;
  }): Observable<Card> {
    return this.http.put<Card>(`${this.baseUrl}/cards/${cardId}`, data).pipe(
      tap(updatedCard => {
        // Update in current board
        this.currentBoardSignal.update(board => {
          if (board) {
            return {
              ...board,
              lists: board.lists.map(l => ({
                ...l,
                cards: l.cards.map(c => c.id === cardId ? updatedCard : c)
              }))
            };
          }
          return board;
        });
        
        // Update card cache
        this.cache.set(`${this.baseUrl}/cards/${cardId}`, updatedCard, {
          ttlMs: 30 * 1000,
          tags: ['cards']
        });
      })
    );
  }

  moveCard(cardId: string, targetListId: string, newRank: number): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/cards/${cardId}/move`, { targetListId, newRank });
  }

  archiveCard(cardId: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/cards/${cardId}/archive`, {}).pipe(
      tap(() => {
        this.currentBoardSignal.update(board => {
          if (board) {
            return {
              ...board,
              lists: board.lists.map(l => ({
                ...l,
                cards: l.cards.filter(c => c.id !== cardId)
              }))
            };
          }
          return board;
        });
      })
    );
  }

  deleteCard(cardId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/cards/${cardId}`);
  }

  lockCard(cardId: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/cards/${cardId}/lock`, {});
  }

  unlockCard(cardId: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/cards/${cardId}/unlock`, {});
  }

  assignUser(cardId: string, userId: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/cards/${cardId}/assign/${userId}`, {});
  }

  unassignUser(cardId: string, userId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/cards/${cardId}/assign/${userId}`);
  }

  // ==================== LABELS ====================

  addLabel(cardId: string, name: string, color: string): Observable<{ id: string; name: string; color: string }> {
    return this.http.post<{ id: string; name: string; color: string }>(`${this.baseUrl}/cards/${cardId}/labels`, { name, color });
  }

  removeLabel(cardId: string, labelId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/cards/${cardId}/labels/${labelId}`);
  }

  // ==================== ASSIGNEES ====================

  addAssignee(cardId: string, userId: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/cards/${cardId}/assignees`, { userId });
  }

  removeAssignee(cardId: string, userId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/cards/${cardId}/assignees/${userId}`);
  }

  // ==================== ARCHIVED LISTS ====================

  getArchivedLists(boardId: string): Observable<BoardList[]> {
    return this.http.get<BoardList[]>(`${this.baseUrl}/${boardId}/archived-lists`);
  }

  restoreList(listId: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/lists/${listId}/restore`, {});
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Force refresh board data
   */
  refreshBoard(boardId: string): Observable<BoardDetail> {
    return this.getBoard(boardId, true);
  }

  /**
   * Clear all cached board data
   */
  clearCache(): void {
    this.cache.invalidateTags(['boards', 'cards']);
    this.boardsSignal.set([]);
    this.currentBoardSignal.set(null);
  }

  /**
   * Prefetch boards for better UX
   */
  prefetchBoards(): void {
    this.getBoards().subscribe();
  }
}
