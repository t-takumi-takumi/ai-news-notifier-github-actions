import { getCacheService } from './CacheService.js';
import { getLogger } from '../utils/Logger.js';

const logger = getLogger();

/**
 * Service for deduplicating articles using seen.json cache
 */
export class DeduplicationService {
  constructor() {
    this.cacheService = getCacheService();
    this._loaded = false;
  }

  /**
   * Initialize service (load cache)
   */
  async initialize() {
    if (!this._loaded) {
      await this.cacheService.load();
      this._loaded = true;
    }
  }

  /**
   * Filter out already seen articles
   */
  async filterNew(articles) {
    await this.initialize();

    const cache = this.cacheService.getCache();
    const newArticles = [];

    for (const article of articles) {
      const hash = article.getHash();

      if (!this.cacheService.has(hash)) {
        newArticles.push(article);
        // Mark as seen
        this.cacheService.add(article.source, hash, article.publishedAt?.toISOString());
      }
    }

    logger.info(`Filtered ${articles.length - newArticles.length} seen articles, ${newArticles.length} new`, 'DeduplicationService');

    return newArticles;
  }

  /**
   * Save updated cache
   */
  async save() {
    await this.cacheService.save();
  }

  /**
   * Clean up old cache entries
   */
  async cleanup() {
    await this.cacheService.cleanup();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const cache = this.cacheService.getCache();
    const stats = {
      total: 0,
      bySource: {}
    };

    for (const [source, entries] of Object.entries(cache.articles)) {
      const count = Object.keys(entries).length;
      stats.total += count;
      stats.bySource[source] = count;
    }

    return stats;
  }
}

// Singleton instance
let dedupeServiceInstance = null;

export function getDeduplicationService() {
  if (!dedupeServiceInstance) {
    dedupeServiceInstance = new DeduplicationService();
  }
  return dedupeServiceInstance;
}
