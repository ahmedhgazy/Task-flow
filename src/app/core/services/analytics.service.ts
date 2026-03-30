import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { WorkspaceDashboard, SprintBurndown } from '../models/board.model';

@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {
  private baseUrl = `${environment.apiUrl}/analytics`;

  constructor(private http: HttpClient) {}

  getWorkspaceDashboard(workspaceId: string): Observable<WorkspaceDashboard> {
    return this.http.get<WorkspaceDashboard>(`${this.baseUrl}/workspaces/${workspaceId}/dashboard`);
  }

  getSprintBurndown(sprintId: string): Observable<SprintBurndown> {
    return this.http.get<SprintBurndown>(`${this.baseUrl}/sprints/${sprintId}/burndown`);
  }
}
