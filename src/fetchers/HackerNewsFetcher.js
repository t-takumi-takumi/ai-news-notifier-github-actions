import { BaseFetcher } from './BaseFetcher.js';

/**
 * Hacker News feed fetcher
 */
export class HackerNewsFetcher extends BaseFetcher {
  constructor(config) {
    super({
      name: 'HackerNews',
      sourceKey: 'hackernews',
      feeds: config.feeds || ['https://hnrss.org/newest'],
      maxArticles: config.maxArticles || 30
    });
  }

  /**
   * Fetch articles from Hacker News
   */
  async fetch() {
    return this.fetchAll();
  }
}
