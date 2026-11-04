import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HelpArticle, HELP_ARTICLES, HELP_TOPICS, HelpTopicId, searchHelpArticles } from './help-center-content';

@Component({
  selector: 'app-help-center',
  templateUrl: './help-center.html',
  styleUrl: './help-center.css',
  standalone: false
})
export class HelpCenterComponent implements OnInit {
  readonly topics = HELP_TOPICS;
  readonly articles = HELP_ARTICLES;
  searchQuery = '';
  selectedTopic: HelpTopicId | null = null;
  currentArticle: HelpArticle | null = null;
  unknownArticle = false;
  showAllArticles = false;

  constructor(private readonly route: ActivatedRoute, private readonly router: Router) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const slug = params.get('slug');
      this.currentArticle = slug ? this.articleForSlug(slug) : null;
      this.unknownArticle = Boolean(slug && !this.currentArticle);
    });
    this.route.queryParamMap.subscribe(params => {
      const topic = params.get('topic');
      this.selectedTopic = HELP_TOPICS.some(item => item.id === topic) ? topic as HelpTopicId : null;
      this.searchQuery = params.get('q') ?? '';
    });
  }

  get visibleArticles(): HelpArticle[] {
    const matches = searchHelpArticles(this.searchQuery, this.articles);
    return this.selectedTopic ? matches.filter(article => article.topicId === this.selectedTopic) : matches;
  }

  get featuredArticles(): HelpArticle[] {
    return this.articles.filter(article => article.featured).slice(0, 3);
  }

  get displayedArticles(): HelpArticle[] {
    if (this.searchQuery.trim() || this.selectedTopic || this.showAllArticles) return this.visibleArticles;
    return this.featuredArticles;
  }

  topicArticleCount(topicId: HelpTopicId): number {
    return this.articles.filter(article => article.topicId === topicId).length;
  }

  showAllGuides(): void {
    this.showAllArticles = true;
  }

  showFeaturedGuides(): void {
    this.showAllArticles = false;
  }

  get hasNoResults(): boolean {
    return Boolean(this.searchQuery.trim() || this.selectedTopic) && this.visibleArticles.length === 0;
  }

  get selectedTopicTitle(): string {
    return this.topics.find(topic => topic.id === this.selectedTopic)?.title ?? 'Tất cả hướng dẫn';
  }

  setTopic(topic: HelpTopicId | null): void {
    this.selectedTopic = topic;
    void this.router.navigate(['/help-center'], {
      queryParams: { topic, q: this.searchQuery.trim() || null },
      queryParamsHandling: 'merge'
    });
  }

  updateSearch(query: string): void {
    this.searchQuery = query;
    void this.router.navigate(['/help-center'], {
      queryParams: { topic: this.selectedTopic, q: query.trim() || null },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  submitSearch(): void {
    const firstResult = this.visibleArticles[0];
    if (firstResult) this.openArticle(firstResult);
  }

  openArticle(article: HelpArticle): void {
    void this.router.navigate(['/help-center', article.slug], {
      queryParams: { topic: this.selectedTopic, q: this.searchQuery.trim() || null }
    });
  }

  articleForSlug(slug: string): HelpArticle | null {
    return this.articles.find(article => article.slug === slug) ?? null;
  }

  topicName(topicId: HelpTopicId): string {
    return this.topics.find(topic => topic.id === topicId)?.title ?? '';
  }

  clearFilters(): void {
    this.searchQuery = '';
    this.selectedTopic = null;
    this.showAllArticles = false;
    void this.router.navigate(['/help-center']);
  }
}
