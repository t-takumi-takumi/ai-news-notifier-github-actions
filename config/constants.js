// Configuration constants

export const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000,    // 1 second
  maxDelay: 10000,    // 10 seconds
  jitter: true        // Add random jitter to avoid thundering herd
};

export const HTTP_CONFIG = {
  timeout: 30000,     // 30 seconds
  userAgent: 'AI-News-Notifier/1.0'
};

export const DISCORD_CONFIG = {
  maxLength: 2000,
  maxRetries: 3,
  retryDelay: 1000
};

export const CACHE_CONFIG = {
  retentionDays: 30,
  filename: 'seen.json',
  version: '1.0'
};

export const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

export const GEMINI_CONFIG = {
  model: 'gemini-3-flash-preview',
  maxSummaryLength: 200,  // characters
  temperature: 0.7,
  maxRetries: 3,
  batchSize: 5  // Process 5 articles at a time
};
