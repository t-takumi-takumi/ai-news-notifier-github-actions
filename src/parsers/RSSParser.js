import Parser from 'rss-parser';
import { getLogger } from '../utils/Logger.js';
import { RetryHandler } from '../utils/RetryHandler.js';

const logger = getLogger();
const parser = new Parser({
  timeout: 30000,
  customFields: {
    item: [
      ['media:content', 'media'],
      ['enclosure', 'enclosure'],
      ['category', 'categories']
    ]
  }
});

/**
 * RSS/Atom feed parser with retry logic
 */
export class RSSParser {
  constructor() {
    this.retryHandler = new RetryHandler();
  }

  /**
   * Encode URL to handle multibyte characters
   */
  _encodeUrl(url) {
    try {
      const urlObj = new URL(url);
      // Only encode the pathname and search params
      const encodedPathname = urlObj.pathname.split('/').map(segment =>
        segment ? encodeURIComponent(segment) : ''
      ).join('/');
      urlObj.pathname = encodedPathname;
      return urlObj.toString();
    } catch {
      // If URL parsing fails, return as-is
      return url;
    }
  }

  /**
   * Parse RSS/Atom feed from URL
   */
  async parse(url, sourceName = 'Unknown') {
    const context = `RSSParser.${sourceName}`;

    return this.retryHandler.execute(async () => {
      try {
        const encodedUrl = this._encodeUrl(url);
        logger.debug(`Fetching feed: ${url}`, context);
        const feed = await parser.parseURL(encodedUrl);
        logger.info(`Fetched ${feed.items?.length || 0} items from ${url}`, context);
        return feed;
      } catch (error) {
        logger.error(`Failed to parse feed: ${url}`, error, context);
        throw error;
      }
    }, context);
  }

  /**
   * Parse multiple feeds in parallel
   */
  async parseMultiple(urls, sourceName = 'Unknown') {
    const context = `RSSParser.${sourceName}`;

    const results = await Promise.allSettled(
      urls.map(url => this.parse(url, sourceName))
    );

    const successful = [];
    const failed = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        successful.push(result.value);
      } else {
        failed.push({ url: urls[index], error: result.reason });
        logger.warn(`Failed to fetch ${urls[index]}: ${result.reason.message}`, context);
      }
    });

    if (failed.length > 0) {
      logger.warn(`Failed to fetch ${failed.length} of ${urls.length} feeds`, context);
    }

    return { successful, failed };
  }

  /**
   * Extract items from feed
   */
  extractItems(feed) {
    if (!feed || !feed.items) {
      return [];
    }
    return feed.items;
  }

  /**
   * Merge items from multiple feeds
   */
  mergeItems(feeds) {
    const allItems = [];
    for (const feed of feeds) {
      if (feed && feed.items) {
        allItems.push(...feed.items);
      }
    }
    return allItems;
  }
}

// Singleton instance
let parserInstance = null;

export function getRSSParser() {
  if (!parserInstance) {
    parserInstance = new RSSParser();
  }
  return parserInstance;
}
