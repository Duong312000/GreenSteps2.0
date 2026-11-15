import { AfterViewInit, Component, ElementRef, Input, OnDestroy, QueryList, ViewChildren } from '@angular/core';

export interface LegalPaymentMethod {
  name: string;
  description: string;
  note: string;
}

export interface LegalSection {
  id: string;
  heading: string;
  paragraphs: string[];
  callout?: { label: string; text: string };
  methods?: LegalPaymentMethod[];
  links?: { label: string; route: string }[];
}

@Component({
  selector: 'app-legal-page-layout',
  templateUrl: './legal-page-layout.html',
  styleUrl: './legal-page-layout.css',
  standalone: false,
})
export class LegalPageLayoutComponent implements AfterViewInit, OnDestroy {
  @Input() title = '';
  @Input() description = '';
  @Input() updatedAt = '';
  @Input() sections: LegalSection[] = [];
  @Input() draftNotice = 'Bản nháp – cần pháp chế xác nhận';
  @Input() finalCta?: { heading: string; description: string; label: string; route: string };
  @ViewChildren('legalSection', { read: ElementRef }) private sectionElements!: QueryList<ElementRef<HTMLElement>>;

  public activeSectionId = '';
  public isTocOpen = false;
  private observer?: IntersectionObserver;

  ngAfterViewInit(): void {
    this.observeSections();
    this.sectionElements.changes.subscribe(() => this.observeSections());
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }

  public scrollToSection(event: Event, id: string): void {
    event.preventDefault();
    document.getElementById(id)?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    });
    this.activeSectionId = id;
    this.isTocOpen = false;
  }

  public printPage(): void {
    window.print();
  }

  public scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }

  private observeSections(): void {
    this.observer?.disconnect();
    if (typeof IntersectionObserver === 'undefined') return;
    this.observer = new IntersectionObserver(entries => {
      const visible = entries
        .filter(entry => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (visible?.target instanceof HTMLElement) this.activeSectionId = visible.target.id;
    }, { rootMargin: '-18% 0px -68% 0px', threshold: 0 });
    this.sectionElements.forEach(section => this.observer?.observe(section.nativeElement));
  }
}
