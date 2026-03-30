import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Checklist, ChecklistItem } from '../models/board.model';

@Injectable({
  providedIn: 'root'
})
export class ChecklistService {
  private apiUrl = `${environment.apiUrl}/checklists`;

  constructor(private http: HttpClient) { }

  createChecklist(cardId: string, title: string): Observable<Checklist> {
    return this.http.post<Checklist>(`${this.apiUrl}/card/${cardId}`, { title });
  }

  deleteChecklist(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  addItem(checklistId: string, content: string): Observable<ChecklistItem> {
    return this.http.post<ChecklistItem>(`${this.apiUrl}/${checklistId}/items`, { content });
  }

  updateItem(itemId: string, content?: string, isChecked?: boolean): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/items/${itemId}`, { content, isChecked });
  }

  deleteItem(itemId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/items/${itemId}`);
  }
}
