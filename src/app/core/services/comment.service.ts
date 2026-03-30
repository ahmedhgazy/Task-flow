import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Comment } from '../models/board.model';

@Injectable({
  providedIn: 'root'
})
export class CommentService {
  private baseUrl = `${environment.apiUrl}/comments`;

  constructor(private http: HttpClient) {}

  getCardComments(cardId: string): Observable<Comment[]> {
    return this.http.get<Comment[]>(`${this.baseUrl}/card/${cardId}`);
  }

  addTextComment(cardId: string, text: string): Observable<Comment> {
    return this.http.post<Comment>(`${this.baseUrl}/card/${cardId}`, { text });
  }

  addVoiceComment(cardId: string, audioBlob: Blob, durationSeconds: number): Observable<Comment> {
    const formData = new FormData();
    formData.append('audioFile', audioBlob, 'voice-note.webm');
    formData.append('durationSeconds', durationSeconds.toString());

    return this.http.post<Comment>(`${this.baseUrl}/card/${cardId}/voice`, formData);
  }

  deleteComment(commentId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${commentId}`);
  }
}
