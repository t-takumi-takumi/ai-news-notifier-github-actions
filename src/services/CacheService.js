import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { getLogger } from '../utils/Logger.js';
import { CACHE_CONFIG } from '../../config/constants.js';

const logger = getLogger();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Service for managing cache file (seen.json)
 */
export class CacheService {
  constructor(cacheDir = null) {
    this.cacheDir = cacheDir || path.join(__dirname, '../../data');
    this.cachePath = path.join(this.cacheDir, CACHE_CONFIG.filename);
    this._cache = null;
  }

  /**
   * Load cache from file
   */
  async load() {
    try {
      const data = await fs.readFile(this.cachePath, 'utf-8');
      this._cache = JSON.parse(data);

      // Validate cache version
      if (this._cache.version !== CACHE_CONFIG.version) {
        logger.warn(`Cache version mismatch, resetting cache`, 'CacheService');
        this._cache = this._createEmptyCache();
      }

      logger.info(`Loaded cache with ${this._getTotalEntries()} entries`, 'CacheService');
      return this._cache;
    } catch (error) {
      if (error.code === 'ENOENT') {
        logger.info('Cache file not found, creating new cache', 'CacheService');
        this._cache = this._createEmptyCache();
        await this.save();
        return this._cache;
      }

      logger.error('Failed to load cache, creating new cache', error, 'CacheService');
      this._cache = this._createEmptyCache();
      await this.save();
      return this._cache;
    }
  }

  /**
   * Save cache to file
   */
  async save() {
    try {
      // Ensure directory exists
      await fs.mkdir(this.cacheDir, { recursive: true });

      // Update timestamp
      this._cache.lastUpdated = new Date().toISOString();

      // Write to file
      await fs.writeFile(this.cachePath, JSON.stringify(this._cache, null, 2), 'utf-8');
      logger.debug('Cache saved successfully', 'CacheService');
    } catch (error) {
      logger.error('Failed to save cache', error, 'CacheService');
      throw error;
    }
  }

  /**
   * Get cache object
   */
  getCache() {
    return this._cache;
  }

  /**
   * Check if article hash exists in cache
   */
  has(hash) {
    if (!this._cache || !this._cache.articles) {
      return false;
    }

    for (const source of Object.values(this._cache.articles)) {
      if (hash in source) {
        return true;
      }
    }

    return false;
  }

  /**
   * Add article hash to cache
   */
  add(source, hash, timestamp = null) {
    if (!this._cache.articles[source]) {
      this._cache.articles[source] = {};
    }

    this._cache.articles[source][hash] = timestamp || new Date().toISOString();
  }

  /**
   * Clean up old entries (older than retention days)
   */
  async cleanup() {
    if (!this._cache || !this._cache.articles) {
      return;
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - CACHE_CONFIG.retentionDays);

    let removedCount = 0;

    for (const source of Object.keys(this._cache.articles)) {
      const entries = this._cache.articles[source];
      for (const [hash, timestamp] of Object.entries(entries)) {
        const entryDate = new Date(timestamp);
        if (entryDate < cutoffDate) {
          delete entries[hash];
          removedCount++;
        }
      }
    }

    if (removedCount > 0) {
      logger.info(`Cleaned up ${removedCount} old cache entries`, 'CacheService');
      await this.save();
    }
  }

  /**
   * Get total number of entries
   */
  _getTotalEntries() {
    if (!this._cache || !this._cache.articles) {
      return 0;
    }

    let total = 0;
    for (const source of Object.values(this._cache.articles)) {
      total += Object.keys(source).length;
    }

    return total;
  }

  /**
   * Create empty cache structure
   */
  _createEmptyCache() {
    return {
      version: CACHE_CONFIG.version,
      lastUpdated: new Date().toISOString(),
      articles: {
        hackernews: {},
        qiita: {},
        zenn: {}
      }
    };
  }

  /**
   * Get cache path (for GitHub Actions cache)
   */
  getCachePath() {
    return this.cachePath;
  }

  /**
   * Get cache directory (for GitHub Actions cache)
   */
  getCacheDir() {
    return this.cacheDir;
  }
}

// Singleton instance
let cacheServiceInstance = null;

export function getCacheService() {
  if (!cacheServiceInstance) {
    cacheServiceInstance = new CacheService();
  }
  return cacheServiceInstance;
}
