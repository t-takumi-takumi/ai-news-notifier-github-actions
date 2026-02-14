import { DISCORD_CONFIG } from '../../config/constants.js';
import { getLogger } from './Logger.js';

const logger = getLogger();

/**
 * Format articles into Discord messages
 */
export class MessageFormatter {
  constructor(sourceConfigs = {}) {
    this.sourceConfigs = sourceConfigs;
  }

  /**
   * Format all articles into Discord message(s)
   */
  format(articlesBySource, totalFetched) {
    const messages = [];

    // Build header
    const header = this._buildHeader();

    // Build sections
    const sections = this._buildSections(articlesBySource);

    // Build stats footer
    const footer = this._buildFooter(articlesBySource, totalFetched);

    // Split into chunks if needed
    const chunks = this._splitIntoChunks(header, sections, footer);

    return chunks;
  }

  /**
   * Build message header
   */
  _buildHeader() {
    const now = new Date();
    const jstDate = new Date(now.getTime() + (9 * 60 * 60 * 1000));
    const dateStr = jstDate.toISOString().slice(0, 10).replace(/-/g, '/');

    return `📰 **AIニュースまとめ** (${dateStr})`;
  }

  /**
   * Build sections by source
   */
  _buildSections(articlesBySource) {
    const sections = [];
    const sourceOrder = ['hackernews', 'qiita', 'zenn'];

    for (const sourceKey of sourceOrder) {
      const articles = articlesBySource[sourceKey];
      if (!articles || articles.length === 0) {
        continue;
      }

      const config = this.sourceConfigs[sourceKey];
      const section = this._buildSection(config, articles);
      sections.push(section);
    }

    return sections;
  }

  /**
   * Build a single section for a source
   */
  _buildSection(config, articles) {
    const lines = [];

    // Section header
    const separator = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    lines.push(separator);
    lines.push(`${config.emoji} **${config.name}** (${articles.length}件)`);
    lines.push(separator);
    lines.push('');

    // Article list
    for (let i = 0; i < articles.length; i++) {
      const article = articles[i];
      const numbered = article.toDiscordFormat().replace(/^1\./, `${i + 1}.`);
      lines.push(numbered);
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Build stats footer
   */
  _buildFooter(articlesBySource, totalFetched) {
    const totalNew = Object.values(articlesBySource).reduce((sum, articles) => sum + articles.length, 0);

    const sourceStats = [];
    const sourceNames = { hackernews: 'HN', qiita: 'Qiita', zenn: 'Zenn' };

    for (const [sourceKey, articles] of Object.entries(articlesBySource)) {
      if (articles.length > 0) {
        sourceStats.push(`${sourceNames[sourceKey]}: ${articles.length}件`);
      }
    }

    const footerLines = [
      '',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '📊 **集計**',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      `全ソース: ${totalFetched}件取得 / 新着: ${totalNew}件`
    ];

    if (sourceStats.length > 0) {
      footerLines.push(`(${sourceStats.join(', ')})`);
    }

    footerLines.push('');
    footerLines.push('🤖 Powered by GitHub Actions');

    return footerLines.join('\n');
  }

  /**
   * Split content into chunks respecting Discord's 2000 char limit
   */
  _splitIntoChunks(header, sections, footer) {
    const chunks = [];
    const maxLength = DISCORD_CONFIG.maxLength;
    const headerPrefix = header + '\n\n';
    const parts = [...sections.map(section => section + '\n\n'), footer];

    let currentChunk = '';

    for (let i = 0; i < parts.length; i++) {
      let remaining = parts[i];

      while (remaining.length > 0) {
        const available = maxLength - currentChunk.length;

        if (available <= 0) {
          chunks.push(currentChunk);
          currentChunk = '';
          continue;
        }

        if (remaining.length <= available) {
          currentChunk += remaining;
          remaining = '';
          continue;
        }

        // Current part doesn't fit in this chunk.
        if (currentChunk.length > 0) {
          chunks.push(currentChunk);
          currentChunk = '';
          continue;
        }

        // Single part is too large; split at a readable boundary.
        const splitPoint = this._findSplitPoint(remaining.slice(0, maxLength));
        chunks.push(remaining.slice(0, splitPoint));
        remaining = remaining.slice(splitPoint).trimStart();
      }
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }

    if (chunks.length === 0) {
      return [headerPrefix + footer];
    }

    if (headerPrefix.length + chunks[0].length <= maxLength) {
      chunks[0] = headerPrefix + chunks[0];
    } else {
      chunks.unshift(headerPrefix.trimEnd());
    }

    return chunks;
  }

  /**
   * Find a good split point in the text (end of an article)
   */
  _findSplitPoint(text) {
    // Look for article boundaries (double newline)
    const articleBoundary = text.lastIndexOf('\n\n');

    if (articleBoundary > text.length * 0.7) {
      return articleBoundary + 2;
    }

    // Fallback to newline
    const newline = text.lastIndexOf('\n');
    if (newline > text.length * 0.8) {
      return newline + 1;
    }

    // Last resort: hard cut
    return Math.floor(text.length * 0.9);
  }

  /**
   * Create simple error message
   */
  formatError(error) {
    return `⚠️ **エラーが発生しました**\n\n${error.message}`;
  }

  /**
   * Create dry-run message
   */
  formatDryRun(articlesBySource) {
    const totalNew = Object.values(articlesBySource).reduce((sum, articles) => sum + articles.length, 0);

    let message = '🧪 **Dry Run Mode**\n\n';
    message += `以下の${totalNew}件の記事を通知します:\n\n`;

    for (const [sourceKey, articles] of Object.entries(articlesBySource)) {
      if (articles.length > 0) {
        message += `${sourceKey}: ${articles.length}件\n`;
        for (const article of articles.slice(0, 3)) {
          const displayTitle = article.getDisplayTitle ? article.getDisplayTitle() : article.title;
          message += `  - ${displayTitle.slice(0, 40)}...\n`;
        }
        if (articles.length > 3) {
          message += `  ... 他${articles.length - 3}件\n`;
        }
        message += '\n';
      }
    }

    return message;
  }
}
