import { BaseFetcher } from './BaseFetcher.js';

/**
 * Qiita feed fetcher
 */
export class QiitaFetcher extends BaseFetcher {
  constructor(config) {
    super({
      name: 'Qiita',
      sourceKey: 'qiita',
      feeds: config.feeds || [
        'https://qiita.com/popular-items/feed.atom'
      ],
      maxArticles: config.maxArticles || 8
    });
  }

  /**
   * Fetch articles from Qiita
   */
  async fetch() {
    return this.fetchAll();
  }
}
