import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

const API_BASE = 'http://localhost:3000/api';

export interface AuthResponse {
  accessToken: string;
}

export interface CurrentUser {
  id: number;
  email: string;
}

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  constructor(private readonly http: HttpClient) {}

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${API_BASE}/auth/login`, { email, password });
  }

  register(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${API_BASE}/auth/register`, { email, password });
  }

  me(): Observable<CurrentUser> {
    return this.http.get<CurrentUser>(`${API_BASE}/auth/me`);
  }
}

