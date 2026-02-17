import { BaseFetcher } from './BaseFetcher.js';

/**
 * Zenn feed fetcher
 */
export class ZennFetcher extends BaseFetcher {
  constructor(config) {
    super({
      name: 'Zenn',
      sourceKey: 'zenn',
      feeds: config.feeds || [
        'https://zenn.dev/feed'
      ],
      maxArticles: config.maxArticles || 8,
      // Trend feed may contain highly-ranked posts older than 24h.
      dateRangeHours: Number.isFinite(config.dateRangeHours) ? config.dateRangeHours : 168
    });
  }

  /**
   * Fetch articles from Zenn
   */
  async fetch() {
    return this.fetchAll();
  }
}
