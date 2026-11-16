import { ComponentFixture, TestBed } from '@angular/core/testing';
import { componentTestModule } from '../../testing/component-test-setup';
import { TourDetail } from './tour-detail';
import { ApiService } from '../../services/api.service';
import { expect, it, vi } from 'vitest';
import { ActivatedRoute } from '@angular/router';

describe('TourDetail', () => {
  let component: TourDetail;
  let fixture: ComponentFixture<TourDetail>;

  beforeEach(async () => {
    await TestBed.configureTestingModule(componentTestModule([TourDetail])).compileComponents();
    fixture = TestBed.createComponent(TourDetail);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('keeps the latest detail request when the route id changes', async () => {
    let resolveFirst!: (tour: any) => void;
    let resolveSecond!: (tour: any) => void;
    const api = TestBed.inject(ApiService);
    (api as any).getPresetTour = vi.fn((id: string) => new Promise(resolve => {
      if (id === 'first') resolveFirst = resolve;
      else resolveSecond = resolve;
    }));
    (component as any).detailRequestSequence = 1;
    const firstRequest = (component as any).loadDetail('first', 1);
    (component as any).detailRequestSequence = 2;
    const secondRequest = (component as any).loadDetail('second', 2);

    resolveSecond({ id: 'second', title: 'Latest', destination: 'Hue', days: 2, data: [], gallery: [] });
    await secondRequest;
    resolveFirst({ id: 'first', title: 'Old', destination: 'Da Lat', days: 2, data: [], gallery: [] });
    await firstRequest;

    expect(component.activeTour?.id).toBe('second');
  });

  it('does not apply reviews from the previous detail after navigation', async () => {
    let resolveReviews!: (rows: any[]) => void;
    const route = TestBed.inject(ActivatedRoute);
    Object.defineProperty(route, 'snapshot', { configurable: true, value: { paramMap: { get: () => 'tour-b' } } });
    component.activeTour = { id: 'tour-b' } as any;
    (component as any).detailRequestSequence = 2;
    const api = TestBed.inject(ApiService) as any;
    api.getTourReviews = vi.fn(() => new Promise(resolve => { resolveReviews = resolve; }));

    const load = component.loadReviews('tour-a', 1);
    resolveReviews([{ id: 'review-a' }]);
    await load;

    expect(component.reviewsList.some(review => review.id === 'review-a')).toBe(false);
  });

  it('does not apply review eligibility for a previous signed-in account', async () => {
    let resolveBookings!: (rows: any[]) => void;
    const route = TestBed.inject(ActivatedRoute);
    Object.defineProperty(route, 'snapshot', { configurable: true, value: { paramMap: { get: () => 'tour-b' } } });
    component.activeTour = { id: 'tour-b', isService: false } as any;
    component.currentUser = { id: 'account-a', role: 'traveler' };
    (component as any).detailRequestSequence = 2;
    const api = TestBed.inject(ApiService) as any;
    api.getBookingsForReviewEligibility = vi.fn(() => new Promise(resolve => { resolveBookings = resolve; }));

    const load = component.loadReviewEligibility(2, 'tour-b');
    component.currentUser = { id: 'account-b', role: 'traveler' };
    resolveBookings([{ id: 'booking-a', status: 'completed', type: 'tour', targetId: 'tour-b' }]);
    await load;

    expect(component.reviewBookings).toEqual([]);
  });

  it('clears the previous tour review state before showing a newly loaded detail', async () => {
    let resolveReviews!: (rows: any[]) => void;
    const route = TestBed.inject(ActivatedRoute);
    Object.defineProperty(route, 'snapshot', { configurable: true, value: { paramMap: { get: () => 'tour-b' }, routeConfig: { path: 'tours/:id' } } });
    component.activeTour = { id: 'tour-a' } as any;
    component.reviewsList = [{ id: 'review-a' }];
    component.filteredReviews = [{ id: 'review-a' }];
    component.reviewBookings = [{ id: 'booking-a' }];
    component.selectedReviewBookingId = 'booking-a';
    (component as any).detailRequestSequence = 2;
    const api = TestBed.inject(ApiService) as any;
    api.getPresetTour = vi.fn().mockResolvedValue({ id: 'tour-b', title: 'B', destination: 'Hue', days: 2, data: [], gallery: [] });
    api.getTourReviews = vi.fn(() => new Promise(resolve => { resolveReviews = resolve; }));

    await (component as any).loadDetail('tour-b', 2);

    expect(component.activeTour?.id).toBe('tour-b');
    expect(component.reviewsList).toEqual([]);
    expect(component.filteredReviews).toEqual([]);
    expect(component.reviewBookings).toEqual([]);
    expect(component.selectedReviewBookingId).toBe('');
    expect(component.isReviewsLoading).toBe(true);
    resolveReviews([]);
  });

  it('shows verified local demo images, switches their credits with the selected gallery photo, and opens the lightbox', () => {
    const first = {
      path: 'image/greensteps/tours/sa-pa/sa-pa-rice-terraces.jpg', caption: 'Ruộng bậc thang ở Sa Pa.',
      alt: 'Ruộng bậc thang Sa Pa', sourcePage: 'https://commons.wikimedia.org/wiki/File:Rice_terraces_in_Sapa,_Vietnam.jpg',
      author: 'Eerin25', licenseId: 'CC0 1.0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      attribution: 'Eerin25, via Wikimedia Commons, CC0 1.0', subjectLocation: 'Sa Pa', verificationStatus: 'verified', modifications: 'Resize only',
      responsiveVariants: [{ path: 'small.jpg', width: 480 }, { path: 'large.jpg', width: 1600 }]
    };
    const second = { ...first, path: 'image/greensteps/tours/sa-pa/sa-pa-fansipan-view.jpg', caption: 'Cáp treo Fansipan.', alt: 'Cáp treo Fansipan ở Sa Pa' };
    component.activeTour = {
      id: 'demo-vn-tour-sa-pa-1', title: 'Sa Pa', destination: 'Sa Pa', days: 3,
      image: first.path, gallery: [first.path, second.path], photoMetadata: [first, second], is_demo: true,
      data: [[], [], []]
    } as any;
    (component as any).setupSlides();

    expect(component.slideImages).toEqual([first.path, second.path]);
    expect(component.activePhotoCredit?.caption).toBe(first.caption);
    expect(component.photoSrcSet(first as any)).toBe('small.jpg 480w, large.jpg 1600w');
    component.setSlide(1);
    expect(component.activePhotoCredit?.alt).toBe(second.alt);
    component.openPhotoGallery(1);
    expect(component.isPhotoGalleryOpen).toBe(true);
    expect(component.galleryPhotoUrl).toBe(second.path);
  });

  it('uses honest demo characteristics and does not fall back to commercial inclusion or deposit promises', () => {
    component.activeTour = {
      id: 'demo-vn-tour-sa-pa-1', title: 'Sa Pa', destination: 'Sa Pa', days: 3,
      is_demo: true, style: 'Trekking', styleExplanation: 'Đi bộ trên đường núi.',
      fitness_level: 'Vận động nhiều', fitnessIsEstimate: true,
      fitnessExplanation: 'Ước tính biên tập theo các hoạt động đề xuất.',
      group_size: undefined, carbon: undefined, included: [], excluded: [], policy: [], highlights: ['Thung lũng Mường Hoa'], data: [[], [], []]
    } as any;

    expect(component.tourStyle).toBe('Trekking');
    expect(component.tourGroupSize).toBe('Chưa xác nhận');
    expect(component.tourFitnessLevel).toBe('Vận động nhiều');
    expect(component.tourIncluded).toEqual([]);
    expect(component.tourExcluded).toEqual([]);
    expect(component.tourPolicies).toEqual([]);
    expect(component.tourHighlights).toEqual(['Thung lũng Mường Hoa']);
  });

  it('only links an itinerary activity to a photo verified for that exact landmark', () => {
    const photo = {
      path: 'image/greensteps/tours/ninh-binh/ninh-binh-trang-an.jpg',
      subjectLocation: 'Quần thể danh thắng Tràng An, Ninh Bình',
      caption: 'Tràng An', relevance: { type: 'exact_landmark', explanation: 'Tràng An có trong lịch trình.' }
    } as any;
    component.activeTour = { is_demo: true, photoMetadata: [photo] } as any;

    expect(component.itineraryPhotoFor({ name: 'Cảnh quan Tràng An' } as any)).toBe(photo);
    expect(component.itineraryPhotoFor({ name: 'Đường làng Ninh Bình' } as any)).toBeUndefined();
    component.activeTour!.photoMetadata = [{ ...photo, relevance: { type: 'destination_context', explanation: 'Bối cảnh.' } }];
    expect(component.itineraryPhotoFor({ name: 'Tràng An' } as any)).toBeUndefined();
  });

});
