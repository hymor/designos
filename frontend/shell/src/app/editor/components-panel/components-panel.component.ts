import { Component } from '@angular/core';

@Component({
  selector: 'app-components-panel',
  standalone: true,
  template: `
    <div class="comps-panel">
      <div class="comps-hint">
        Select a frame or element and click <strong class="comps-hint-strong">Make Component</strong> to define a reusable component.
      </div>
      <div id="comp-list">
        <div class="comp-list-empty">No components yet.</div>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        --surface: #1c1c1e;
        --surface2: #242428;
        --border: #333338;
        --text: #e8e8ea;
        --text3: #4a4a52;
      }

      .comps-panel {
        display: flex;
        flex-direction: column;
        min-height: 0;
      }

      .comps-hint {
        padding: 0 14px 10px;
        font-size: 10px;
        color: var(--text3);
      }

      .comps-hint-strong {
        color: #f7c948;
      }

      #comp-list {
        flex: 1;
        overflow-y: auto;
        padding: 0 14px;
      }

      .comp-list-empty {
        font-size: 11px;
        color: var(--text3);
        padding: 8px 0;
      }

      .comp-list-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 5px 8px;
        background: var(--surface2);
        border: 1px solid var(--border);
        border-radius: 5px;
        margin-bottom: 4px;
        font-size: 11px;
        cursor: pointer;
      }

      .comp-list-item:hover {
        border-color: #f7c948;
        color: var(--text);
      }
    `,
  ],
})
export class ComponentsPanelComponent {}
