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
        'https://qiita.com/popular-items/feed.atom',
        'https://qiita.com/tags/ai/feed.atom',
        'https://qiita.com/tags/llm/feed.atom',
        'https://qiita.com/tags/chatgpt/feed.atom',
        'https://qiita.com/tags/生成ai/feed.atom',
        'https://qiita.com/tags/機械学習/feed.atom'
      ],
      maxArticles: config.maxArticles || 20
    });
  }

  /**
   * Fetch articles from Qiita
   */
  async fetch() {
    return this.fetchAll();
  }
}
