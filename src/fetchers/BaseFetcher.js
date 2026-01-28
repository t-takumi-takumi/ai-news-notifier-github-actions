import { getRSSParser } from '../parsers/RSSParser.js';
import { getArticleNormalizer } from '../parsers/ArticleNormalizer.js';
import { getLogger } from '../utils/Logger.js';

const logger = getLogger();

/**
 * Abstract base class for feed fetchers
 */
export class BaseFetcher {
  constructor(config) {
    if (new.target === BaseFetcher) {
      throw new Error('BaseFetcher is abstract and cannot be instantiated directly');
    }

    this.name = config.name;
    this.sourceKey = config.sourceKey; // e.g., 'hackernews', 'qiita', 'zenn'
    this.feeds = Array.isArray(config.feeds) ? config.feeds : [config.feeds];
    this.maxArticles = config.maxArticles || 20;
    this.parser = getRSSParser();
    this.normalizer = getArticleNormalizer();
  }

  /**
   * Fetch articles - to be implemented by subclasses
   */
  async fetch() {
    throw new Error('fetch() must be implemented by subclass');
  }

  /**
   * Fetch all feeds and return normalized articles
   */
  async fetchAll() {
    const context = `BaseFetcher.${this.name}`;

    try {
      // Parse all feeds
      const { successful, failed } = await this.parser.parseMultiple(this.feeds, this.name);

      if (successful.length === 0) {
        logger.error(`Failed to fetch any feeds from ${this.name}`, null, context);
        return [];
      }

      // Merge all items
      const allItems = this.parser.mergeItems(successful);
      logger.info(`Fetched ${allItems.length} items from ${successful.length} feeds`, context);

      // Normalize to Articles
      let articles = this.normalizer.normalizeAll(allItems, this.sourceKey);

      // Deduplicate by hash
      articles = this.normalizer.deduplicateByHash(articles);

      // Sort by published date
      articles = this.normalizer.sortByPublishedDate(articles);

      // Filter by date range (last 24 hours)
      articles = this.normalizer.filterByDateRange(articles, 24);

      // Limit to max articles
      articles = this.normalizer.limit(articles, this.maxArticles);

      logger.info(`Returning ${articles.length} articles from ${this.name}`, context);

      return {
        articles,
        feedCount: successful.length,
        itemCount: allItems.length,
        failedCount: failed.length
      };
    } catch (error) {
      logger.error(`Failed to fetch articles from ${this.name}`, error, context);
      return [];
    }
  }

  /**
   * Get fetcher info
   */
  getInfo() {
    return {
      name: this.name,
      sourceKey: this.sourceKey,
      feeds: this.feeds,
      maxArticles: this.maxArticles
    };
  }
}
