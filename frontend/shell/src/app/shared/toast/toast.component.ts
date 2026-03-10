import { AsyncPipe, NgClass, NgIf } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Subscription, timer } from 'rxjs';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [AsyncPipe, NgIf, NgClass],
  template: `
    @if (message$ | async; as m) {
      <div
        id="toast"
        [class.show]="visible"
        [class.toast-error]="m.kind === 'error'"
      >
        {{ m.text }}
      </div>
    }
  `,
  styles: [
    `
      :host {
        --surface3: #2c2c30;
        --border: #333338;
        --text: #e8e8ea;
      }

      #toast {
        position: fixed;
        bottom: 18px;
        left: 50%;
        transform: translateX(-50%) translateY(10px);
        background: var(--surface3);
        border: 1px solid var(--border);
        color: var(--text);
        font-size: 12px;
        padding: 7px 16px;
        border-radius: 8px;
        opacity: 0;
        transition: all 0.2s;
        pointer-events: none;
        z-index: 999;
        white-space: nowrap;
      }

      #toast.show {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }

      .toast-error {
        border-color: #c44;
      }
    `,
  ],
})
export class ToastComponent implements OnInit, OnDestroy {
  private readonly toastService = inject(ToastService);
  private sub?: Subscription;
  visible = false;
  readonly message$ = this.toastService.message$;

  ngOnInit(): void {
    this.sub = this.toastService.message$.subscribe((msg) => {
      if (!msg) {
        this.visible = false;
        return;
      }
      this.visible = true;
      timer(2500).subscribe(() => {
        this.visible = false;
      });
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }
}

