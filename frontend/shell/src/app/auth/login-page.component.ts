import { AsyncPipe, NgIf } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { AuthService } from '../core/services/auth.service';

@Component({
  standalone: true,
  selector: 'app-login-page',
  imports: [FormsModule, RouterLink, AsyncPipe, NgIf],
  template: `
    <div class="auth-page">
      <div class="auth-card">
        <h1>Sign in</h1>
        <form (ngSubmit)="onSubmit()" #form="ngForm">
          <label>
            Email
            <input type="email" name="email" [(ngModel)]="email" required />
          </label>
          <label>
            Password
            <input type="password" name="password" [(ngModel)]="password" required />
          </label>
          <button type="submit" [disabled]="loading$ | async">Log in</button>
          <div class="error" *ngIf="(error$ | async) as err">{{ err }}</div>
        </form>
        <p class="meta">
          No account?
          <a routerLink="/auth/register">Create one</a>
        </p>
      </div>
    </div>
  `,
  styles: [
    `
      .auth-page {
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #111112;
        color: #e8e8ea;
        font-family: 'Segoe UI', Helvetica, sans-serif;
      }
      .auth-card {
        width: 320px;
        padding: 24px 24px 20px;
        border-radius: 12px;
        background: #1c1c1e;
        border: 1px solid #333338;
        box-shadow: 0 18px 40px rgba(0, 0, 0, 0.6);
      }
      h1 {
        margin: 0 0 16px;
        font-size: 18px;
      }
      label {
        display: flex;
        flex-direction: column;
        gap: 4px;
        font-size: 13px;
        margin-bottom: 12px;
      }
      input {
        border-radius: 8px;
        border: 1px solid #333338;
        background: #242428;
        color: #e8e8ea;
        padding: 8px 10px;
        outline: none;
      }
      input:focus {
        border-color: #7b61ff;
      }
      button {
        width: 100%;
        margin-top: 4px;
        border-radius: 8px;
        border: none;
        padding: 8px 0;
        background: #7b61ff;
        color: #fff;
        font-weight: 600;
        cursor: pointer;
      }
      button[disabled] {
        opacity: 0.6;
        cursor: default;
      }
      .error {
        margin-top: 8px;
        color: #ff6b6b;
        font-size: 12px;
      }
      .meta {
        margin-top: 14px;
        font-size: 12px;
        color: #888890;
      }
      .meta a {
        color: #7b61ff;
        text-decoration: none;
      }
    `,
  ],
})
export class LoginPageComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  email = '';
  password = '';

  readonly loading$ = new BehaviorSubject<boolean>(false);
  readonly error$ = new BehaviorSubject<string | null>(null);

  onSubmit(): void {
    if (!this.email || !this.password) return;
    this.loading$.next(true);
    this.error$.next(null);
    this.auth.login(this.email, this.password).subscribe({
      next: () => {
        this.loading$.next(false);
        this.router.navigate(['/projects']);
      },
      error: (err) => {
        this.loading$.next(false);
        const msg =
          (err && typeof err === 'object' && 'message' in err && typeof (err as any).message === 'string'
            ? (err as any).message
            : String(err)) || 'Login failed';
        this.error$.next(msg);
      },
    });
  }
}

