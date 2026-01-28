import crypto from 'crypto';

/**
 * Article model representing a normalized news article
 */
export class Article {
  constructor({ title, url, source, publishedAt = null, author = null, summary = null, tags = [] }) {
    this.title = this._sanitize(title);
    this.url = this._normalizeUrl(url);
    this.source = source;
    this.publishedAt = publishedAt ? new Date(publishedAt) : null;
    this.author = author;
    this.summary = summary ? this._truncate(summary, 200) : null;
    this.tags = Array.isArray(tags) ? tags : [];
    this.id = this._generateId();
    // AI-generated fields
    this.aiSummary = null;
    this.translatedTitle = null;
  }

  /**
   * Set AI-generated summary
   */
  setAiSummary(summary) {
    this.aiSummary = summary;
  }

  /**
   * Set translated title
   */
  setTranslatedTitle(title) {
    this.translatedTitle = title;
  }

  /**
   * Get display title (translated or original)
   */
  getDisplayTitle() {
    return this.translatedTitle || this.title;
  }

  /**
   * Generate unique ID using SHA-256 hash
   */
  _generateId() {
    const data = `${this.source}:${this.url}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Normalize URL (remove trailing slash, UTM parameters)
   */
  _normalizeUrl(url) {
    if (!url) return '';

    let normalized = url.trim();

    // Remove trailing slash
    if (normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }

    try {
      const urlObj = new URL(normalized);
      // Remove UTM parameters
      const utmParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
      utmParams.forEach(param => urlObj.searchParams.delete(param));
      normalized = urlObj.toString();
    } catch {
      // Invalid URL, return as-is
    }

    return normalized;
  }

  /**
   * Sanitize title (remove extra whitespace)
   */
  _sanitize(text) {
    if (!text) return '';
    return text.trim().replace(/\s+/g, ' ');
  }

  /**
   * Truncate text to max length
   */
  _truncate(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3) + '...';
  }

  /**
   * Get hash for deduplication
   */
  getHash() {
    return this.id;
  }

  /**
   * Format for Discord display (simplified with AI summary)
   */
  toDiscordFormat() {
    const lines = [];

    // Title (translated or original, truncated to 100 chars)
    const displayTitle = this.getDisplayTitle();
    const title = this._truncate(displayTitle, 100);
    lines.push(`1. ${title}`);

    // AI Summary (if available)
    if (this.aiSummary) {
      lines.push(`💬 ${this.aiSummary}`);
    }

    // URL (wrapped in angle brackets to disable embeds)
    lines.push(`🔗 <${this.url}>`);

    return lines.join('\n');
  }

  /**
   * Check if article is within last N hours
   */
  isWithinLastHours(hours = 24) {
    if (!this.publishedAt) return true; // Assume new if no date
    const now = new Date();
    const hoursAgo = new Date(now.getTime() - (hours * 60 * 60 * 1000));
    return this.publishedAt >= hoursAgo;
  }
}
