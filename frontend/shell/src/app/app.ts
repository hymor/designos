import { Component } from '@angular/core';
import { EditorShellComponent } from './editor/editor-shell/editor-shell.component';

@Component({
  selector: 'app-root',
  imports: [EditorShellComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {}
