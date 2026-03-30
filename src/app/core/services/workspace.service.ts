import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Workspace, WorkspaceMember, WorkspaceInvitation } from '../models/board.model';

@Injectable({
  providedIn: 'root'
})
export class WorkspaceService {
  private baseUrl = `${environment.apiUrl}/workspaces`;

  constructor(private http: HttpClient) {}

  getWorkspaces(): Observable<Workspace[]> {
    return this.http.get<Workspace[]>(this.baseUrl);
  }

  getWorkspace(id: string): Observable<Workspace> {
    return this.http.get<Workspace>(`${this.baseUrl}/${id}`);
  }

  createWorkspace(data: { name: string; description?: string }): Observable<Workspace> {
    return this.http.post<Workspace>(this.baseUrl, data);
  }

  updateWorkspace(id: string, data: { name: string; description?: string; logoUrl?: string }): Observable<Workspace> {
    return this.http.put<Workspace>(`${this.baseUrl}/${id}`, data);
  }

  deleteWorkspace(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  getMembers(workspaceId: string): Observable<WorkspaceMember[]> {
    return this.http.get<WorkspaceMember[]>(`${this.baseUrl}/${workspaceId}/members`);
  }

  inviteMember(workspaceId: string, email: string, role: string = 'Member'): Observable<{ message: string; token: string }> {
    return this.http.post<{ message: string; token: string }>(`${this.baseUrl}/${workspaceId}/invite`, { email, role });
  }

  acceptInvitation(token: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/accept-invitation`, { token });
  }

  removeMember(workspaceId: string, userId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${workspaceId}/members/${userId}`);
  }

  getMyInvitations(): Observable<WorkspaceInvitation[]> {
    return this.http.get<WorkspaceInvitation[]>(`${this.baseUrl}/invitations`);
  }

  rejectInvitation(token: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/invitations/${token}/reject`, {});
  }
}
