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
        'https://zenn.dev/feed',
        'https://zenn.dev/topics/ai/feed',
        'https://zenn.dev/topics/llm/feed',
        'https://zenn.dev/topics/chatgpt/feed',
        'https://zenn.dev/topics/生成ai/feed'
      ],
      maxArticles: config.maxArticles || 20
    });
  }

  /**
   * Fetch articles from Zenn
   */
  async fetch() {
    return this.fetchAll();
  }
}
