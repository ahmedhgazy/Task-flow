import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface SearchResultItem {
  id: string;
  title: string;
  description: string;
  type: 'Board' | 'Card';
  url: string;
  subTitle?: string;
}

export interface SearchResponse {
  items: SearchResultItem[];
}

@Injectable({
  providedIn: 'root'
})
export class SearchService {
  private apiUrl = `${environment.apiUrl}/search`;

  constructor(private http: HttpClient) {}

  search(query: string, workspaceId?: string): Observable<SearchResponse> {
    let url = `${this.apiUrl}?q=${encodeURIComponent(query)}`;
    if (workspaceId) {
      url += `&workspaceId=${workspaceId}`;
    }
    return this.http.get<SearchResponse>(url);
  }
}
