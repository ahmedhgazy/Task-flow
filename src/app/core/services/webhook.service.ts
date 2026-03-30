import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Webhook } from '../models/board.model';

@Injectable({
  providedIn: 'root'
})
export class WebhookService {
  private baseUrl = `${environment.apiUrl}/webhooks`;

  constructor(private http: HttpClient) {}

  getWorkspaceWebhooks(workspaceId: string): Observable<Webhook[]> {
    return this.http.get<Webhook[]>(`${this.baseUrl}/workspaces/${workspaceId}`);
  }

  createWebhook(workspaceId: string, data: { url: string; secret?: string; events: string[] }): Observable<Webhook> {
    return this.http.post<Webhook>(`${this.baseUrl}/workspaces/${workspaceId}`, data);
  }

  updateWebhook(webhookId: string, data: { url: string; secret?: string; events: string[]; isActive: boolean }): Observable<Webhook> {
    return this.http.put<Webhook>(`${this.baseUrl}/${webhookId}`, data);
  }

  deleteWebhook(webhookId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${webhookId}`);
  }
}
