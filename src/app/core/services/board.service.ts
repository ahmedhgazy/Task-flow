import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Board, BoardDetail, BoardList, Card, CardPriority, CardType } from '../models/board.model';

@Injectable({
  providedIn: 'root'
})
export class BoardService {
  private baseUrl = `${environment.apiUrl}/boards`;

  constructor(private http: HttpClient) {}

  // Boards
  getWorkspaceBoards(workspaceId: string): Observable<Board[]> {
    return this.http.get<Board[]>(`${this.baseUrl}/workspace/${workspaceId}`);
  }

  getBoards(): Observable<Board[]> {
    return this.http.get<Board[]>(`${this.baseUrl}`);
  }

  getBoard(boardId: string): Observable<BoardDetail> {
    return this.http.get<BoardDetail>(`${this.baseUrl}/${boardId}`);
  }

  createBoard(workspaceId: string, data: { name: string; description?: string; backgroundColor?: string }): Observable<Board> {
    return this.http.post<Board>(`${this.baseUrl}/workspace/${workspaceId}`, data);
  }

  updateBoard(boardId: string, data: { name: string; description?: string; backgroundColor?: string }): Observable<Board> {
    return this.http.put<Board>(`${this.baseUrl}/${boardId}`, data);
  }

  archiveBoard(boardId: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${boardId}/archive`, {});
  }

  deleteBoard(boardId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${boardId}`);
  }

  // Lists
  createList(boardId: string, data: { name: string; rank?: number }): Observable<BoardList> {
    return this.http.post<BoardList>(`${this.baseUrl}/${boardId}/lists`, data);
  }

  updateList(listId: string, data: { name: string }): Observable<BoardList> {
    return this.http.put<BoardList>(`${this.baseUrl}/lists/${listId}`, data);
  }

  moveList(listId: string, newRank: number): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/lists/${listId}/move`, { newRank });
  }

  archiveList(listId: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/lists/${listId}/archive`, {});
  }

  deleteList(listId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/lists/${listId}`);
  }

  // Cards
  createCard(listId: string, data: {
    title: string; description?: string; priority?: CardPriority;
    type?: CardType; storyPoints?: number; estimatedHours?: number;
    dueDate?: Date; sprintId?: string; epicId?: string;
  }): Observable<Card> {
    return this.http.post<Card>(`${this.baseUrl}/lists/${listId}/cards`, data);
  }

  getCard(cardId: string): Observable<Card> {
    return this.http.get<Card>(`${this.baseUrl}/cards/${cardId}`);
  }

  updateCard(cardId: string, data: {
    title: string; description?: string; priority: CardPriority;
    type: CardType; storyPoints?: number; estimatedHours?: number;
    dueDate?: Date; sprintId?: string; epicId?: string;
  }): Observable<Card> {
    return this.http.put<Card>(`${this.baseUrl}/cards/${cardId}`, data);
  }

  moveCard(cardId: string, targetListId: string, newRank: number): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/cards/${cardId}/move`, { targetListId, newRank });
  }

  archiveCard(cardId: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/cards/${cardId}/archive`, {});
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

  // Labels
  addLabel(cardId: string, name: string, color: string): Observable<{ id: string; name: string; color: string }> {
    return this.http.post<{ id: string; name: string; color: string }>(`${this.baseUrl}/cards/${cardId}/labels`, { name, color });
  }

  removeLabel(cardId: string, labelId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/cards/${cardId}/labels/${labelId}`);
  }

  // Assignees (body-based alternative)
  addAssignee(cardId: string, userId: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/cards/${cardId}/assignees`, { userId });
  }

  removeAssignee(cardId: string, userId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/cards/${cardId}/assignees/${userId}`);
  }

  // Archived Lists
  getArchivedLists(boardId: string): Observable<BoardList[]> {
    return this.http.get<BoardList[]>(`${this.baseUrl}/${boardId}/archived-lists`);
  }

  restoreList(listId: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/lists/${listId}/restore`, {});
  }
}
