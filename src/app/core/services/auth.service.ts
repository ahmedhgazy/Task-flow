import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, throwError, BehaviorSubject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthResponse, LoginRequest, RegisterRequest, UserDto } from '../models/auth.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly ACCESS_TOKEN_KEY = 'accessToken';
  private readonly REFRESH_TOKEN_KEY = 'refreshToken';
  private readonly USER_KEY = 'user';

  private currentUserSubject = new BehaviorSubject<UserDto | null>(this.getStoredUser());
  currentUser$ = this.currentUserSubject.asObservable();

  get currentUserValue(): UserDto | null {
    return this.currentUserSubject.getValue();
  }

  isAuthenticated = signal(this.hasValidToken());
  isAdmin = signal(this.checkIsAdmin());

  constructor(
    private http: HttpClient,
    private router: Router
  ) {}

  register(request: RegisterRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${environment.apiUrl}/auth/register`, request)
      .pipe(
        tap(response => this.handleAuthResponse(response)),
        catchError(this.handleError)
      );
  }

  login(request: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${environment.apiUrl}/auth/login`, request)
      .pipe(
        tap(response => this.handleAuthResponse(response)),
        catchError(this.handleError)
      );
  }

  refreshToken(): Observable<AuthResponse> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      return throwError(() => new Error('No refresh token'));
    }

    return this.http.post<AuthResponse>(`${environment.apiUrl}/auth/refresh`, { refreshToken })
      .pipe(
        tap(response => this.handleAuthResponse(response)),
        catchError(error => {
          this.logout();
          return throwError(() => error);
        })
      );
  }

  logout(): void {
    const refreshToken = this.getRefreshToken();
    if (refreshToken) {
      this.http.post(`${environment.apiUrl}/auth/revoke`, { refreshToken }).subscribe();
    }

    localStorage.removeItem(this.ACCESS_TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);

    this.currentUserSubject.next(null);
    this.isAuthenticated.set(false);
    this.isAdmin.set(false);

    this.router.navigate(['/login']);
  }

  getCurrentUser(): Observable<UserDto> {
    return this.http.get<UserDto>(`${environment.apiUrl}/auth/me`);
  }

  getAccessToken(): string | null {
    return localStorage.getItem(this.ACCESS_TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(this.REFRESH_TOKEN_KEY);
  }

  private handleAuthResponse(response: AuthResponse): void {
    localStorage.setItem(this.ACCESS_TOKEN_KEY, response.accessToken);
    localStorage.setItem(this.REFRESH_TOKEN_KEY, response.refreshToken);

    const user: UserDto = {
      id: response.userId,
      email: response.email,
      firstName: response.firstName,
      lastName: response.lastName,
      isActive: true,
      createdAt: new Date()
    };

    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    this.currentUserSubject.next(user);
    this.isAuthenticated.set(true);
    this.isAdmin.set(response.roles.includes('Admin'));
  }

  private hasValidToken(): boolean {
    return !!this.getAccessToken();
  }

  private checkIsAdmin(): boolean {
    try {
      const token = this.getAccessToken();
      if (!token) return false;

      const payload = JSON.parse(atob(token.split('.')[1]));
      const roles = payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] || [];
      return Array.isArray(roles) ? roles.includes('Admin') : roles === 'Admin';
    } catch {
      return false;
    }
  }

  private getStoredUser(): UserDto | null {
    try {
      const stored = localStorage.getItem(this.USER_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }

  private handleError(error: any): Observable<never> {
    let message = 'An error occurred';

    if (error.error) {
       if (typeof error.error === 'string') {
          message = error.error;
       } else if (error.error.message) {
          message = error.error.message;
       } else if (error.error.errors) {
          // Handle ValidationProblemDetails
          const errors = error.error.errors;
          // If it's an object of arrays, flatten them
          const messages = Object.values(errors).flat();
          if (messages.length > 0) {
             message = messages.join('\n'); // Use newline for better display if snackbar allows, or ", "
          }
       }
    }

    return throwError(() => new Error(message));
  }
}
