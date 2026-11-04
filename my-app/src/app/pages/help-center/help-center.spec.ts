import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { HelpCenterComponent } from './help-center';
import { HELP_ARTICLES } from './help-center-content';

describe('HelpCenterComponent', () => {
  function createComponent() {
    const router = { navigate: vi.fn() } as unknown as Router;
    const route = {} as ActivatedRoute;
    return { component: new HelpCenterComponent(route, router), router };
  }

  it('filters articles by selected topic and can return to all topics', () => {
    const { component } = createComponent();
    component.setTopic('planner');
    expect(component.visibleArticles.length).toBeGreaterThan(0);
    expect(component.visibleArticles.every(article => article.topicId === 'planner')).toBe(true);
    component.setTopic(null);
    expect(component.visibleArticles).toHaveLength(HELP_ARTICLES.length);
  });

  it('shows every catalog article after selecting view all and reports real topic counts', () => {
    const { component } = createComponent();
    expect(component.displayedArticles).toHaveLength(component.featuredArticles.length);
    component.showAllGuides();
    expect(component.displayedArticles).toHaveLength(HELP_ARTICLES.length);
    expect(component.topicArticleCount('booking')).toBe(
      HELP_ARTICLES.filter(article => article.topicId === 'booking').length
    );
  });

  it('combines search and topic filter and exposes a no-results state', () => {
    const { component } = createComponent();
    component.setTopic('payments');
    component.searchQuery = 'mã QR';
    expect(component.visibleArticles.map(article => article.slug)).toContain('thanh-toan-booking');
    component.searchQuery = 'không có nội dung này';
    expect(component.visibleArticles).toEqual([]);
    expect(component.hasNoResults).toBe(true);
  });

  it('resolves known article slugs and identifies unknown slugs', () => {
    const { component } = createComponent();
    expect(component.articleForSlug('dat-tour-tren-greensteps')?.topicId).toBe('booking');
    expect(component.articleForSlug('unknown')).toBeNull();
  });

  it('reacts to article and filter route parameters', () => {
    const router = { navigate: vi.fn() } as unknown as Router;
    const params = new BehaviorSubject(convertToParamMap({ slug: 'dat-tour-tren-greensteps' }));
    const queryParams = new BehaviorSubject(convertToParamMap({ topic: 'booking', q: 'dat tour' }));
    const route = { paramMap: params, queryParamMap: queryParams } as unknown as ActivatedRoute;
    const component = new HelpCenterComponent(route, router);
    component.ngOnInit();
    expect(component.currentArticle?.slug).toBe('dat-tour-tren-greensteps');
    expect(component.selectedTopic).toBe('booking');
    expect(component.searchQuery).toBe('dat tour');
    params.next(convertToParamMap({ slug: 'unknown' }));
    expect(component.unknownArticle).toBe(true);
    queryParams.next(convertToParamMap({}));
    expect(component.searchQuery).toBe('');
    expect(component.selectedTopic).toBeNull();
  });

  it('navigates to an article route when a result is selected', () => {
    const { component, router } = createComponent();
    component.searchQuery = 'đặt tour';
    component.selectedTopic = 'booking';
    component.openArticle(HELP_ARTICLES[0]);
    expect(router.navigate).toHaveBeenCalledWith(['/help-center', HELP_ARTICLES[0].slug], {
      queryParams: { topic: 'booking', q: 'đặt tour' }
    });
  });

  it('writes search input to the current URL entry so browser Back restores the query', () => {
    const { component, router } = createComponent();
    component.selectedTopic = 'booking';
    component.updateSearch('đặt tour');
    expect(router.navigate).toHaveBeenCalledWith(['/help-center'], {
      queryParams: { topic: 'booking', q: 'đặt tour' },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  });
});
