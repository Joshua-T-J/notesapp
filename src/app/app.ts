import { Component, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { Sidebar } from './components/sidebar/sidebar';

@Component({
  imports: [Sidebar],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = signal('Nota — Lively & Serene Privacy-First Notes Studio');
  private readonly isSidebarOpen = signal(true);

  constructor(titleService: Title) {
    titleService.setTitle(this.title());
  }

  onSidebarToggle(isOpen: boolean): void {
    this.isSidebarOpen.set(isOpen);
  }

  openSidebar(): void {
    this.isSidebarOpen.set(true);
  }
}
