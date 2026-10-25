import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

const paths: Record<string, string> = {
  home: 'm3 10 9-7 9 7 M5 9v12h5v-7h4v7h5V9',
  briefcase: 'M4 7h16v13H4z M8 7V4h8v3 M4 12h16 M10 11v3h4v-3',
  calendar: 'M4 5h16v16H4z M8 3v4 M16 3v4 M4 10h16 M8 14h2 M14 14h2 M8 18h2',
  megaphone: 'm4 9 15-5v16L4 15z M4 9H2v6h2 M7 16l2 5h3l-2-4 M22 9v6',
  tag: 'M3 3h8l10 10-8 8L3 11z M7 7h.01',
  chart: 'M4 20V12h4v8 M10 20V7h4v13 M16 20V3h4v17',
  revenue: 'M4 6c0-4 16-4 16 0s-16 4-16 0 M4 6v12c0 4 16 4 16 0V6 M4 12c0 4 16 4 16 0',
  star: 'm12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z',
  layers: 'm3 7 9-5 9 5-9 5z M3 12l9 5 9-5 M3 17l9 5 9-5',
  arrow: 'M4 12h16 m-6-6 6 6-6 6',
  chevron: 'm9 5 7 7-7 7',
  menu: 'M4 6h16 M4 12h16 M4 18h16',
  close: 'm6 6 12 12 M6 18 18 6',
  leaf: 'M20 3C6 2 2 11 6 17c9 5 15-4 14-14 M3 22c2-6 6-11 12-14',
  plus: 'M12 4v16 M4 12h16',
  users:
    'M16 21v-3c0-5-12-5-12 0v3 M10 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M17 4c5 0 5 7 1 7 M20 21v-3c0-2-1-3-3-4',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M12 7v5l3 2',
  check: 'M4 4h16v16H4z m4 8 3 3 6-7',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12 M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
  download: 'M12 3v12 m-5-5 5 5 5-5 M4 16v5h16v-5',
  refresh: 'M20 7a8 8 0 1 0 1 9 M20 3v5h-5',
};

@Component({
  selector: 'app-partner-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path [attr.d]="path" /></svg>',
  styles: [
    ':host{display:inline-flex;width:22px;height:22px;flex-shrink:0;align-items:center;justify-content:center}svg{width:100%;height:100%}',
  ],
})
export class PartnerIconComponent {
  @Input() name = 'home';
  get path(): string {
    return paths[this.name] || paths['briefcase'];
  }
}
