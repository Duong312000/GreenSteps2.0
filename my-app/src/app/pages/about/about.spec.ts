import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AboutComponent } from './about';
import { ABOUT_MILESTONES } from './about-data';

describe('About page integrity and interactions', () => {
  let fixture: ComponentFixture<AboutComponent>;
  let http: HttpTestingController;
  beforeEach(async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    );
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    await TestBed.configureTestingModule({
      imports: [AboutComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(AboutComponent);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    fixture.destroy();
    http.verify();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('omits statistics and makes no catalog requests', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.facts-section')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('GreenSteps qua những con số');
    http.expectNone(() => true);
  });

  it('keeps the six supplied team members and CTA alongside the official story', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.founder').length).toBe(6);
    expect(fixture.nativeElement.textContent).toContain('Thanh Tran Duy');
    expect(fixture.nativeElement.textContent).toContain('Cố vấn chuyên môn');
    expect(fixture.nativeElement.querySelector('#story-year').value).toBe('2026');
    expect(fixture.nativeElement.querySelectorAll('.milestone').length).toBe(5);
    expect(fixture.nativeElement.querySelector('.journey-link').getAttribute('href')).toBe(
      '/tours',
    );
  });

  it('preserves all official dates and only offers years present in the official data', () => {
    fixture.detectChanges();
    expect(ABOUT_MILESTONES.map((item) => item.dateLabel)).toEqual([
      '05/06/2026',
      '07/06/2026',
      '09/09/2026',
      '09/10/2026',
      '11/2026',
    ]);
    expect(ABOUT_MILESTONES[4].date).toBe('2026-11');
    expect(fixture.componentInstance.storyYears).toEqual(['2026']);
    expect(fixture.nativeElement.querySelectorAll('#story-year option').length).toBe(1);
    expect(fixture.nativeElement.querySelector('.story-navigation')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('time')[4].textContent).toContain('11/2026');
  });

  it('scrolls to exact milestone positions, clamps navigation and keeps the selected year synchronized', () => {
    fixture.detectChanges();
    const track = fixture.nativeElement.querySelector('.story-track');
    track.scrollTo = vi.fn();
    track
      .querySelectorAll('.milestone')
      .forEach((card: HTMLElement, index: number) =>
        Object.defineProperty(card, 'offsetLeft', { value: index * 424 }),
      );
    Object.defineProperties(track, {
      clientWidth: { value: 800 },
      scrollWidth: { value: 2496 },
      scrollLeft: { value: 0, writable: true },
    });
    fixture.componentInstance.updateCarousel();
    expect(fixture.componentInstance.canPrevious).toBe(false);
    expect(fixture.componentInstance.canNext).toBe(true);
    fixture.componentInstance.scrollStory(1);
    expect(track.scrollTo).toHaveBeenCalledWith({ left: 424, behavior: 'smooth' });
    track.scrollLeft = 848;
    fixture.componentInstance.updateCarousel();
    expect(fixture.componentInstance.activeStoryYear).toBe('2026');
    fixture.componentInstance.scrollToStory(99);
    expect(track.scrollTo).toHaveBeenLastCalledWith({ left: 1696, behavior: 'smooth' });
    track.scrollLeft = 1696;
    fixture.componentInstance.updateCarousel();
    expect(fixture.componentInstance.canPrevious).toBe(true);
    expect(fixture.componentInstance.canNext).toBe(false);
    expect(fixture.componentInstance.activeStoryYear).toBe('2026');
  });

  it('navigates to the first milestone of the chosen year', () => {
    // A future year is a test fixture only, not production company history.
    fixture.componentInstance.milestones = [
      ...ABOUT_MILESTONES,
      { ...ABOUT_MILESTONES[0], id: 'future-test', date: '2027-01-01' },
    ];
    fixture.detectChanges();
    const navigate = vi
      .spyOn(fixture.componentInstance, 'scrollToStory')
      .mockImplementation(() => {});
    const select = fixture.nativeElement.querySelector('#story-year');
    select.value = '2027';
    select.dispatchEvent(new Event('change'));
    expect(navigate).toHaveBeenCalledWith(5);
  });

  it('supports keyboard navigation without intercepting keys on nested read-more buttons', () => {
    fixture.detectChanges();
    const navigate = vi
      .spyOn(fixture.componentInstance, 'scrollToStory')
      .mockImplementation(() => {});
    const track = fixture.nativeElement.querySelector('.story-track');
    track.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(navigate).toHaveBeenCalledWith(4);
    navigate.mockClear();
    track
      .querySelector('button')
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    expect(navigate).not.toHaveBeenCalled();
  });

  it('allows the full official description to be expanded and collapsed accessibly', () => {
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('.story-read-more');
    const description = fixture.nativeElement.querySelector('.milestone-description');
    expect(description.textContent.trim()).toBe(ABOUT_MILESTONES[0].description);
    button.click();
    fixture.detectChanges();
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(description.classList.contains('is-expanded')).toBe(true);
    button.click();
    fixture.detectChanges();
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });

  it('uses a poster without loading the video when reduced motion is requested', () => {
    vi.mocked(window.matchMedia).mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as MediaQueryList);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('video source')).toBeNull();
    expect(fixture.nativeElement.querySelector('video').autoplay).toBe(false);
    expect(fixture.nativeElement.querySelector('.hero-poster').getAttribute('src')).toBe(
      'media/about/hero-poster.jpg',
    );
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
    const track = fixture.nativeElement.querySelector('.story-track');
    track.scrollTo = vi.fn();
    fixture.componentInstance.scrollToStory(0);
    expect(track.scrollTo).toHaveBeenCalledWith({ left: 0, behavior: 'instant' });
  });
});
