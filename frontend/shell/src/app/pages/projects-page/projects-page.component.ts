import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-projects-page',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="page">
      <div class="header">
        <h1 class="title">Projects</h1>
        <p class="subtitle">Select a project to open the editor.</p>
      </div>

      <div class="list">
        <a class="project" [routerLink]="['/project', 'demo-1']">
          <div class="name">Demo</div>
          <div class="meta">id: demo-1</div>
        </a>
        <a class="project" [routerLink]="['/project', 'default']">
          <div class="name">Default</div>
          <div class="meta">id: default</div>
        </a>
      </div>
    </div>
  `,
  styles: [
    `
      .page {
        height: 100%;
        min-height: 0;
        padding: 1rem;
      }
      .header {
        margin-bottom: 1rem;
      }
      .title {
        margin: 0;
        font-size: 1.25rem;
        font-weight: 650;
      }
      .subtitle {
        margin: 0.25rem 0 0 0;
        color: #666;
        font-size: 0.9rem;
      }
      .list {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: 0.75rem;
      }
      .project {
        display: block;
        padding: 0.75rem;
        border: 1px solid #e2e2e2;
        border-radius: 10px;
        text-decoration: none;
        color: inherit;
        background: #fff;
      }
      .project:hover {
        background: #f6f6f8;
        border-color: #d6d6d6;
      }
      .name {
        font-weight: 600;
      }
      .meta {
        margin-top: 0.25rem;
        font-size: 0.8rem;
        color: #666;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
          monospace;
      }
    `,
  ],
})
export class ProjectsPageComponent {}

