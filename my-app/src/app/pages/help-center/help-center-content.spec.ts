import { HELP_ARTICLES, HELP_TOPICS, normalizeHelpText, searchHelpArticles } from './help-center-content';

describe('Help Center content and search', () => {
  it('normalizes Vietnamese accents, case, and the letter đ', () => {
    expect(normalizeHelpText('ĐẶT ĐIỂM Xanh')).toBe('dat diem xanh');
  });

  it('searches article body and keywords as well as titles', () => {
    expect(searchHelpArticles('mã QR').some(article => article.slug === 'thanh-toan-booking')).toBe(true);
    expect(searchHelpArticles('diem xanh').some(article => article.topicId === 'green-points')).toBe(true);
  });

  it('returns no results for a non-matching query and all articles for an empty query', () => {
    expect(searchHelpArticles('câu hỏi không tồn tại')).toEqual([]);
    expect(searchHelpArticles('')).toHaveLength(HELP_ARTICLES.length);
  });

  it('provides 8 to 12 articles across the six help topics', () => {
    expect(HELP_TOPICS).toHaveLength(6);
    expect(HELP_ARTICLES.length).toBeGreaterThanOrEqual(8);
    expect(HELP_ARTICLES.length).toBeLessThanOrEqual(12);
    expect(new Set(HELP_ARTICLES.map(article => article.topicId))).toEqual(new Set(HELP_TOPICS.map(topic => topic.id)));
  });
});
