import { Article } from '../models/Article.js';
import { getLogger } from '../utils/Logger.js';

const logger = getLogger();

/**
 * Normalize RSS/Atom items to Article model
 */
export class ArticleNormalizer {
  constructor() {
    // Source-specific normalizers
    this.normalizers = {
      hackernews: this._normalizeHackerNews.bind(this),
      qiita: this._normalizeQiita.bind(this),
      zenn: this._normalizeZenn.bind(this)
    };
  }

  /**
   * Normalize a single RSS item to Article
   */
  normalize(item, source) {
    try {
      const normalizer = this.normalizers[source];
      if (!normalizer) {
        logger.warn(`No normalizer found for source: ${source}`, 'ArticleNormalizer');
        return this._normalizeGeneric(item, source);
      }

      const articleData = normalizer(item);
      return new Article({ ...articleData, source });
    } catch (error) {
      logger.warn(`Failed to normalize item from ${source}: ${error.message}`, 'ArticleNormalizer');
      return null;
    }
  }

  /**
   * Normalize multiple items
   */
  normalizeAll(items, source) {
    if (!items || !Array.isArray(items)) {
      return [];
    }

    const articles = [];
    for (const item of items) {
      const article = this.normalize(item, source);
      if (article) {
        articles.push(article);
      }
    }

    logger.debug(`Normalized ${articles.length}/${items.length} items from ${source}`, 'ArticleNormalizer');
    return articles;
  }

  /**
   * Normalize Hacker News item
   */
  _normalizeHackerNews(item) {
    return {
      title: item.title || 'Untitled',
      url: item.link || item.guid || '',
      publishedAt: item.pubDate || item.isoDate || null,
      author: item.creator || item.author || null,
      summary: item.contentSnippet || item.content || null,
      tags: []
    };
  }

  /**
   * Normalize Qiita item
   */
  _normalizeQiita(item) {
    // Extract tags from categories
    const tags = this._extractTags(item.category);

    return {
      title: item.title || 'Untitled',
      url: item.link || '',
      publishedAt: item.pubDate || null,
      author: item.creator || item.author || null,
      summary: item.contentSnippet || item.description || null,
      tags
    };
  }

  /**
   * Normalize Zenn item
   */
  _normalizeZenn(item) {
    // Extract tags from categories
    const tags = this._extractTags(item.category);

    return {
      title: item.title || 'Untitled',
      url: item.link || '',
      publishedAt: item.pubDate || item.isoDate || null,
      author: item.author || item.creator || null,
      summary: item.contentSnippet || item.summary || null,
      tags
    };
  }

  /**
   * Generic normalizer for unknown sources
   */
  _normalizeGeneric(item, source) {
    const tags = this._extractTags(item.category);

    return {
      title: item.title || 'Untitled',
      url: item.link || item.guid || '',
      publishedAt: item.pubDate || item.isoDate || null,
      author: item.creator || item.author || null,
      summary: item.contentSnippet || item.description || item.content || null,
      tags
    };
  }

  /**
   * Extract tags from category field (can be string or array)
   */
  _extractTags(category) {
    if (!category) return [];

    let categories = [];

    if (Array.isArray(category)) {
      categories = category;
    } else if (typeof category === 'string') {
      categories = [category];
    } else if (category._) {
      // Some feeds use object with _ property
      categories = [category._];
    }

    return categories
      .map(c => typeof c === 'string' ? c.toLowerCase() : c)
      .filter(Boolean);
  }

  /**
   * Deduplicate articles by URL
   */
  deduplicateByHash(articles) {
    const seen = new Set();
    const unique = [];

    for (const article of articles) {
      const hash = article.getHash();
      if (!seen.has(hash)) {
        seen.add(hash);
        unique.push(article);
      }
    }

    logger.debug(`Deduplicated: ${unique.length}/${articles.length} unique articles`, 'ArticleNormalizer');
    return unique;
  }

  /**
   * Sort articles by published date (newest first)
   */
  sortByPublishedDate(articles) {
    return articles.sort((a, b) => {
      if (!a.publishedAt) return 1;
      if (!b.publishedAt) return -1;
      return b.publishedAt - a.publishedAt;
    });
  }

  /**
   * Filter articles by date range (last N hours)
   */
  filterByDateRange(articles, hours = 24) {
    return articles.filter(article => article.isWithinLastHours(hours));
  }

  /**
   * Limit to N articles
   */
  limit(articles, maxArticles) {
    if (articles.length <= maxArticles) {
      return articles;
    }
    return articles.slice(0, maxArticles);
  }
}

// Singleton instance
let normalizerInstance = null;

export function getArticleNormalizer() {
  if (!normalizerInstance) {
    normalizerInstance = new ArticleNormalizer();
  }
  return normalizerInstance;
}
