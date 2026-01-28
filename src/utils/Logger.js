import { LOG_LEVELS } from '../../config/constants.js';

/**
 * Structured logger with levels and timestamps
 */
export class Logger {
  constructor(level = 'INFO') {
    this.level = LOG_LEVELS[level] ?? LOG_LEVELS.INFO;
    this.levels = LOG_LEVELS;
  }

  _shouldLog(level) {
    return level >= this.level;
  }

  _formatMessage(level, context, message) {
    const timestamp = new Date().toISOString();
    const levelName = Object.keys(this.levels).find(key => this.levels[key] === level);
    return `[${timestamp}] [${levelName}]${context ? ` [${context}]` : ''} ${message}`;
  }

  debug(message, context = '') {
    if (this._shouldLog(this.levels.DEBUG)) {
      console.log(this._formatMessage(this.levels.DEBUG, context, message));
    }
  }

  info(message, context = '') {
    if (this._shouldLog(this.levels.INFO)) {
      console.log(this._formatMessage(this.levels.INFO, context, message));
    }
  }

  warn(message, context = '') {
    if (this._shouldLog(this.levels.WARN)) {
      console.warn(this._formatMessage(this.levels.WARN, context, message));
    }
  }

  error(message, error = null, context = '') {
    if (this._shouldLog(this.levels.ERROR)) {
      const errorText = error ? `: ${error.message}` : '';
      console.error(this._formatMessage(this.levels.ERROR, context, message + errorText));
      if (error?.stack) {
        console.error(error.stack);
      }
    }
  }
}

// Singleton instance
let loggerInstance = null;

export function getLogger(level = 'INFO') {
  if (!loggerInstance) {
    const envLevel = process.env.LOG_LEVEL || level;
    loggerInstance = new Logger(envLevel);
  }
  return loggerInstance;
}
