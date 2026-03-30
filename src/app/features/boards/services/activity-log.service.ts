import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface ActivityLog {
  id: string;
  boardId: string;
  cardId?: string;
  actionType: string;
  details: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  timestamp: string;
}

@Injectable({
  providedIn: 'root'
})
export class ActivityLogService {
  private apiUrl = `${environment.apiUrl}/activity-logs`;

  constructor(private http: HttpClient) {}

  getBoardActivity(boardId: string, take: number = 50): Observable<ActivityLog[]> {
    return this.http.get<ActivityLog[]>(`${this.apiUrl}/board/${boardId}?take=${take}`);
  }

  getCardActivity(cardId: string, take: number = 20): Observable<ActivityLog[]> {
    return this.http.get<ActivityLog[]>(`${this.apiUrl}/card/${cardId}?take=${take}`);
  }
}
