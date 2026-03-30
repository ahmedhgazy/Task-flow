import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AutomationRule, AutomationTriggerType, AutomationActionType } from '../models/board.model';

@Injectable({
  providedIn: 'root'
})
export class AutomationService {
  private baseUrl = `${environment.apiUrl}/automations`;

  constructor(private http: HttpClient) {}

  getBoardRules(boardId: string): Observable<AutomationRule[]> {
    return this.http.get<AutomationRule[]>(`${this.baseUrl}/boards/${boardId}`);
  }

  createRule(boardId: string, data: {
    name?: string;
    triggerType: AutomationTriggerType;
    triggerValue?: string;
    actionType: AutomationActionType;
    actionValue?: string;
  }): Observable<AutomationRule> {
    return this.http.post<AutomationRule>(`${this.baseUrl}/boards/${boardId}`, data);
  }

  updateRule(ruleId: string, data: {
    name?: string;
    triggerType: AutomationTriggerType;
    triggerValue?: string;
    actionType: AutomationActionType;
    actionValue?: string;
    isEnabled: boolean;
  }): Observable<AutomationRule> {
    return this.http.put<AutomationRule>(`${this.baseUrl}/${ruleId}`, data);
  }

  deleteRule(ruleId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${ruleId}`);
  }
}
