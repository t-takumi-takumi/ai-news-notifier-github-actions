import { RETRY_CONFIG } from '../../config/constants.js';
import { getLogger } from './Logger.js';

const logger = getLogger();

/**
 * Retry handler with exponential backoff
 */
export class RetryHandler {
  constructor(config = {}) {
    this.maxRetries = config.maxRetries ?? RETRY_CONFIG.maxRetries;
    this.baseDelay = config.baseDelay ?? RETRY_CONFIG.baseDelay;
    this.maxDelay = config.maxDelay ?? RETRY_CONFIG.maxDelay;
    this.jitter = config.jitter ?? RETRY_CONFIG.jitter;
  }

  /**
   * Calculate delay with exponential backoff
   */
  _calculateDelay(attempt) {
    const exponentialDelay = this.baseDelay * Math.pow(2, attempt);
    let delay = Math.min(exponentialDelay, this.maxDelay);

    // Add jitter to avoid thundering herd
    if (this.jitter) {
      delay = delay * (0.5 + Math.random());
    }

    return Math.floor(delay);
  }

  /**
   * Sleep for specified milliseconds
   */
  async _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Execute function with retry logic
   */
  async execute(fn, context = 'RetryHandler') {
    let lastError;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        if (attempt === this.maxRetries) {
          logger.error(`Max retries (${this.maxRetries}) exceeded`, error, context);
          throw error;
        }

        const delay = this._calculateDelay(attempt);
        logger.warn(`Attempt ${attempt + 1}/${this.maxRetries + 1} failed, retrying in ${delay}ms`, context);

        await this._sleep(delay);
      }
    }

    throw lastError;
  }

  /**
   * Execute async function with retry (shorthand)
   */
  static async retry(fn, config = {}, context = 'RetryHandler') {
    const handler = new RetryHandler(config);
    return handler.execute(fn, context);
  }
}
