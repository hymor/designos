import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of, switchMap, tap } from 'rxjs';
import { AuthApiService, CurrentUser } from './auth-api.service';

const TOKEN_KEY = 'designos_token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly currentUserSubject = new BehaviorSubject<CurrentUser | null>(null);
  readonly currentUser$ = this.currentUserSubject.asObservable();

  constructor(private readonly api: AuthApiService) {
    const token = this.getToken();
    if (token) {
      this.refreshMe().subscribe();
    }
  }

  getToken(): string | null {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
  }

  setToken(token: string | null): void {
    if (typeof localStorage === 'undefined') return;
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  }

  login(email: string, password: string): Observable<CurrentUser> {
    return this.api.login(email, password).pipe(
      tap((res) => this.setToken(res.accessToken)),
      switchMap(() => this.refreshMe()),
    );
  }

  register(email: string, password: string): Observable<CurrentUser> {
    return this.api.register(email, password).pipe(
      tap((res) => this.setToken(res.accessToken)),
      switchMap(() => this.refreshMe()),
    );
  }

  refreshMe(): Observable<CurrentUser> {
    if (!this.getToken()) {
      this.currentUserSubject.next(null);
      return of(null as any);
    }
    return this.api.me().pipe(
      tap((user) => this.currentUserSubject.next(user)),
    );
  }

  logout(): void {
    this.setToken(null);
    this.currentUserSubject.next(null);
  }
}

