import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'projects' },
  {
    path: 'projects',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/projects-page/projects-page.component').then((m) => m.ProjectsPageComponent),
  },
  {
    path: 'project/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/project-page/project-page.component').then((m) => m.ProjectPageComponent),
  },
  {
    path: 'auth/login',
    loadComponent: () => import('./auth/login-page.component').then((m) => m.LoginPageComponent),
  },
  {
    path: 'auth/register',
    loadComponent: () => import('./auth/register-page.component').then((m) => m.RegisterPageComponent),
  },
  { path: '**', redirectTo: 'projects' },
];
