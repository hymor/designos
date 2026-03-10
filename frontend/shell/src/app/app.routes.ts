import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'projects' },
  {
    path: 'projects',
    loadComponent: () => import('./pages/projects-page/projects-page.component').then((m) => m.ProjectsPageComponent),
  },
  {
    path: 'project/:id',
    loadComponent: () =>
      import('./pages/project-page/project-page.component').then((m) => m.ProjectPageComponent),
  },
  { path: '**', redirectTo: 'projects' },
];
