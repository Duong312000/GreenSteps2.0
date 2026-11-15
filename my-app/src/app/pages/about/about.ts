import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  inject,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';
import { ABOUT_FOUNDERS, ABOUT_MILESTONES, ABOUT_VALUES, StoryMilestone } from './about-data';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './about.html',
  styleUrl: './about.css',
})
export class AboutComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('heroVideo') heroVideo?: ElementRef<HTMLVideoElement>;
  @ViewChild('storyTrack') storyTrack?: ElementRef<HTMLElement>;
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly zone = inject(NgZone);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly previousTitle = this.title.getTitle();
  private readonly previousDescription = this.meta.getTag('name="description"')?.content;
  private revealObserver?: IntersectionObserver;
  private videoObserver?: IntersectionObserver;
  private headerObserver?: ResizeObserver;
  private motionQuery?: MediaQueryList;
  private heroVisible = true;
  private manuallyPaused = false;
  readonly founders = ABOUT_FOUNDERS;
  readonly values = ABOUT_VALUES;
  readonly missingPortraits = new Set<string>();
  milestones: readonly StoryMilestone[] = ABOUT_MILESTONES;
  activeStoryIndex = 0;
  readonly expandedStories = new Set<string>();
  storyDragging = false;
  private storyPointer?: { id: number; x: number; left: number };
  private storyResizeObserver?: ResizeObserver;
  videoPlaying = false;
  videoFailed = false;
  reducedMotion = false;
  canPrevious = false;
  canNext = false;

  get storyYears(): string[] {
    return [...new Set(this.milestones.map((item) => item.date.slice(0, 4)))].sort();
  }

  get activeStoryYear(): string {
    return this.milestones[this.activeStoryIndex]?.date.slice(0, 4) || this.storyYears[0] || '';
  }

  selectStoryYear(event: Event): void {
    const year = (event.target as HTMLSelectElement).value;
    const index = this.milestones.findIndex((item) => item.date.startsWith(year + '-'));
    if (index >= 0) this.scrollToStory(index);
  }

  ngOnInit(): void {
    this.title.setTitle('Về GreenSteps Travel | Du lịch xanh, trải nghiệm thật');
    this.meta.updateTag({
      name: 'description',
      content:
        'Khám phá GreenSteps Travel: những hành trình có trách nhiệm với thiên nhiên, văn hóa và cộng đồng địa phương tại Việt Nam.',
    });
    this.motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.reducedMotion = this.motionQuery.matches;
    this.motionQuery.addEventListener('change', this.onMotionChange);
  }

  ngAfterViewInit(): void {
    const header = document.querySelector('app-header header');
    if (header) {
      const measure = () =>
        this.host.nativeElement.style.setProperty(
          '--about-nav-height',
          `${header.getBoundingClientRect().height}px`,
        );
      measure();
      this.headerObserver = new ResizeObserver(measure);
      this.headerObserver.observe(header);
    }
    this.zone.runOutsideAngular(() => {
      if ('IntersectionObserver' in window) {
        this.revealObserver = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                this.revealObserver?.unobserve(entry.target);
              }
            });
          },
          { threshold: 0.08 },
        );
        this.host.nativeElement
          .querySelectorAll<HTMLElement>('[data-reveal]')
          .forEach((section) => {
            section.classList.add('reveal-ready');
            this.revealObserver?.observe(section);
          });
        this.videoObserver = new IntersectionObserver(
          (entries) => {
            this.heroVisible = entries[0].isIntersecting;
            this.syncVideo();
          },
          { threshold: 0.05 },
        );
        if (this.heroVideo) this.videoObserver.observe(this.heroVideo.nativeElement);
      }
    });
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.syncVideo();
    queueMicrotask(() => this.updateCarousel());
    if (this.storyTrack && 'ResizeObserver' in window) {
      this.storyResizeObserver = new ResizeObserver(() => this.updateCarousel());
      this.storyResizeObserver.observe(this.storyTrack.nativeElement);
    }
  }

  private readonly onMotionChange = (event: MediaQueryListEvent): void => {
    this.reducedMotion = event.matches;
    this.syncVideo();
    this.cdr.markForCheck();
  };
  private readonly onVisibilityChange = (): void => this.syncVideo();

  private syncVideo(): void {
    const video = this.heroVideo?.nativeElement;
    if (!video) return;
    video.muted = true; // Safari requires the DOM property as well as the attribute.
    if (
      !this.heroVisible ||
      document.hidden ||
      this.reducedMotion ||
      this.manuallyPaused ||
      this.videoFailed
    )
      video.pause();
    else
      void video.play().catch(() => {
        /* Native poster and play button remain available. */
      });
  }

  toggleVideo(): void {
    const video = this.heroVideo?.nativeElement;
    if (!video) return;
    this.manuallyPaused = !video.paused;
    if (video.paused) {
      this.manuallyPaused = false;
      void video.play().catch(() => {
        this.videoPlaying = false;
        this.cdr.markForCheck();
      });
    } else video.pause();
  }

  scrollToStory(index: number): void {
    const track = this.storyTrack?.nativeElement;
    const cards = track?.querySelectorAll<HTMLElement>('.milestone');
    if (!track || !cards?.length) return;
    const target = Math.max(0, Math.min(index, cards.length - 1));
    this.activeStoryIndex = target;
    track.scrollTo({
      left: cards[target].offsetLeft - cards[0].offsetLeft,
      behavior: this.reducedMotion ? 'instant' : 'smooth',
    });
  }

  scrollStory(direction: number): void {
    this.scrollToStory(this.activeStoryIndex + direction);
  }

  updateCarousel(): void {
    const track = this.storyTrack?.nativeElement;
    this.canPrevious = !!track && track.scrollLeft > 2;
    this.canNext = !!track && track.scrollLeft + track.clientWidth < track.scrollWidth - 2;
    if (track) {
      const cards = Array.from(track.querySelectorAll<HTMLElement>('.milestone'));
      const origin = cards[0]?.offsetLeft || 0;
      let distance = Infinity;
      cards.forEach((card, index) => {
        const candidate = Math.abs(card.offsetLeft - origin - track.scrollLeft);
        if (candidate < distance) {
          distance = candidate;
          this.activeStoryIndex = index;
        }
      });
    }
    this.cdr.markForCheck();
  }

  onStoryKeydown(event: KeyboardEvent): void {
    if (event.target !== event.currentTarget) return;
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'Home') this.scrollToStory(0);
    else if (event.key === 'End') this.scrollToStory(this.milestones.length - 1);
    else this.scrollStory(event.key === 'ArrowRight' ? 1 : -1);
  }

  onStoryPointerDown(event: PointerEvent): void {
    if (
      event.pointerType !== 'mouse' ||
      event.button !== 0 ||
      (event.target as HTMLElement).closest('button, a')
    )
      return;
    const track = this.storyTrack?.nativeElement;
    if (track)
      this.storyPointer = { id: event.pointerId, x: event.clientX, left: track.scrollLeft };
  }

  onStoryPointerMove(event: PointerEvent): void {
    const track = this.storyTrack?.nativeElement;
    const pointer = this.storyPointer;
    if (!track || !pointer || pointer.id !== event.pointerId) return;
    if (!this.storyDragging && Math.abs(event.clientX - pointer.x) < 6) return;
    this.storyDragging = true;
    if (!track.hasPointerCapture(event.pointerId)) track.setPointerCapture(event.pointerId);
    event.preventDefault();
    track.scrollLeft = pointer.left - (event.clientX - pointer.x);
  }

  onStoryPointerEnd(event: PointerEvent): void {
    const track = this.storyTrack?.nativeElement;
    if (track?.hasPointerCapture(event.pointerId)) track.releasePointerCapture(event.pointerId);
    this.storyPointer = undefined;
    this.storyDragging = false;
    this.updateCarousel();
  }

  toggleStory(id: string): void {
    if (this.expandedStories.has(id)) this.expandedStories.delete(id);
    else this.expandedStories.add(id);
  }

  scrollToIntroduction(): void {
    this.host.nativeElement
      .querySelector('#about-introduction')
      ?.scrollIntoView({ behavior: this.reducedMotion ? 'instant' : 'smooth' });
  }

  ngOnDestroy(): void {
    this.revealObserver?.disconnect();
    this.videoObserver?.disconnect();
    this.headerObserver?.disconnect();
    this.storyResizeObserver?.disconnect();
    this.motionQuery?.removeEventListener('change', this.onMotionChange);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.heroVideo?.nativeElement.pause();
    this.title.setTitle(this.previousTitle);
    if (this.previousDescription !== undefined)
      this.meta.updateTag({ name: 'description', content: this.previousDescription });
    else this.meta.removeTag('name="description"');
  }
}
