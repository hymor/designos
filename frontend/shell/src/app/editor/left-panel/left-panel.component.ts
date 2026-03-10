import { Component } from '@angular/core';
import { LayersPanelComponent } from '../layers-panel/layers-panel.component';
import { ComponentsPanelComponent } from '../components-panel/components-panel.component';

@Component({
  selector: 'app-left-panel',
  standalone: true,
  imports: [LayersPanelComponent, ComponentsPanelComponent],
  template: `
    <div id="left-panel">
      <div class="ph" style="padding:0">
        <button
          type="button"
          class="tbtn"
          [class.on]="activeTab === 'layers'"
          id="tab-layers"
          (click)="activeTab = 'layers'"
        >
          LAYERS
        </button>
        <button
          type="button"
          class="tbtn"
          [class.on]="activeTab === 'comps'"
          id="tab-comps"
          (click)="activeTab = 'comps'"
        >
          COMPONENTS
        </button>
      </div>

      <div
        id="layers-tab"
        class="left-tab-content"
        [class.left-tab-visible]="activeTab === 'layers'"
      >
        <div id="layers">
          <app-layers-panel></app-layers-panel>
        </div>
      </div>

      <div
        id="comps-tab"
        class="left-tab-content comps-tab"
        [class.left-tab-visible]="activeTab === 'comps'"
      >
        <app-components-panel></app-components-panel>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        --panel: 230px;
        --surface: #1c1c1e;
        --surface2: #242428;
        --surface3: #2c2c30;
        --border: #333338;
        --text: #e8e8ea;
        --text2: #888890;
        --text3: #4a4a52;
        --accent: #7b61ff;
      }

      #left-panel {
        width: var(--panel);
        min-width: var(--panel);
        background: var(--surface);
        border-right: 1px solid var(--border);
        display: flex;
        flex-direction: column;
        padding-top: 8px;
        box-sizing: border-box;
        flex-shrink: 0;
        min-height: 0;
      }

      .ph {
        padding: 0;
        border-bottom: 1px solid var(--border);
        font-size: 10px;
        font-weight: 700;
        color: var(--text3);
        letter-spacing: 1px;
        text-transform: uppercase;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .ph .tbtn {
        flex: 1;
        border-radius: 0;
        height: 36px;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.5px;
        color: var(--text2);
        border: none;
        background: transparent;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .ph .tbtn:hover {
        background: var(--surface3);
        color: var(--text);
      }

      .ph .tbtn.on {
        background: var(--accent);
        color: #fff;
      }

      .left-tab-content {
        display: none;
        flex: 1;
        overflow-y: auto;
        flex-direction: column;
        min-height: 0;
      }

      .left-tab-content.left-tab-visible {
        display: flex;
      }

      .left-tab-content.comps-tab {
        padding: 12px 0;
      }

      #layers {
        flex: 1;
        overflow-y: auto;
        min-height: 0;
        display: flex;
        flex-direction: column;
      }

      #layers::-webkit-scrollbar {
        width: 3px;
      }

      #layers::-webkit-scrollbar-thumb {
        background: var(--border);
        border-radius: 2px;
      }
    `,
  ],
})
export class LeftPanelComponent {
  activeTab: 'layers' | 'comps' = 'layers';
}
