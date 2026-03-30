import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Sprint, SprintCardSummary } from '../models/board.model';

@Injectable({
  providedIn: 'root'
})
export class SprintService {
  private baseUrl = `${environment.apiUrl}/sprints`;

  constructor(private http: HttpClient) {}

  getBoardSprints(boardId: string): Observable<Sprint[]> {
    return this.http.get<Sprint[]>(`${this.baseUrl}/boards/${boardId}`);
  }

  getBacklogCards(boardId: string): Observable<SprintCardSummary[]> {
    return this.http.get<SprintCardSummary[]>(`${this.baseUrl}/boards/${boardId}/backlog`);
  }

  getSprint(sprintId: string): Observable<Sprint> {
    return this.http.get<Sprint>(`${this.baseUrl}/${sprintId}`);
  }

  createSprint(boardId: string, data: { name: string; goal?: string; startDate?: Date; endDate?: Date }): Observable<Sprint> {
    return this.http.post<Sprint>(`${this.baseUrl}/boards/${boardId}`, data);
  }

  updateSprint(sprintId: string, data: { name: string; goal?: string; startDate?: Date; endDate?: Date }): Observable<Sprint> {
    return this.http.put<Sprint>(`${this.baseUrl}/${sprintId}`, data);
  }

  startSprint(sprintId: string): Observable<Sprint> {
    return this.http.post<Sprint>(`${this.baseUrl}/${sprintId}/start`, {});
  }

  completeSprint(sprintId: string): Observable<Sprint> {
    return this.http.post<Sprint>(`${this.baseUrl}/${sprintId}/complete`, {});
  }

  deleteSprint(sprintId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${sprintId}`);
  }

  addCardsToSprint(sprintId: string, cardIds: string[]): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${sprintId}/cards`, { cardIds });
  }

  removeCardFromSprint(sprintId: string, cardId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${sprintId}/cards/${cardId}`);
  }
}
