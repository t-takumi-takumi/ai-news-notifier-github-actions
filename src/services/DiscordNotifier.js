import axios from 'axios';
import { RetryHandler } from '../utils/RetryHandler.js';
import { getLogger } from '../utils/Logger.js';
import { DISCORD_CONFIG } from '../../config/constants.js';

const logger = getLogger();

/**
 * Discord webhook notification service
 */
export class DiscordNotifier {
  constructor(webhookUrl) {
    this.webhookUrl = webhookUrl;
    this.retryHandler = new RetryHandler({
      maxRetries: DISCORD_CONFIG.maxRetries,
      baseDelay: DISCORD_CONFIG.retryDelay
    });
  }

  /**
   * Send notification to Discord
   */
  async send(messages) {
    if (!this.webhookUrl) {
      throw new Error('DISCORD_WEBHOOK_URL is not set');
    }

    if (!Array.isArray(messages)) {
      messages = [messages];
    }

    const results = [];

    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      const result = await this._sendMessage(message, i + 1, messages.length);
      results.push(result);

      // Add small delay between messages to avoid rate limiting
      if (i < messages.length - 1) {
        await this._sleep(500);
      }
    }

    return results;
  }

  /**
   * Send a single message
   */
  async _sendMessage(content, index, total) {
    const context = `DiscordNotifier.send[${index}/${total}]`;

    return this.retryHandler.execute(async () => {
      try {
        logger.debug(`Sending message ${index}/${total} (${content.length} chars)`, context);

        const response = await axios.post(
          this.webhookUrl,
          { content },
          {
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000
          }
        );

        if (response.status >= 200 && response.status < 300) {
          logger.info(`Message ${index}/${total} sent successfully`, context);
          return { success: true, index };
        }

        throw new Error(`Unexpected status code: ${response.status}`);
      } catch (error) {
        logger.error(`Failed to send message ${index}/${total}`, error, context);
        throw error;
      }
    }, context);
  }

  /**
   * Send error notification
   */
  async sendError(error) {
    const message = this._formatErrorMessage(error);
    return this.send(message);
  }

  /**
   * Format error message
   */
  _formatErrorMessage(error) {
    let message = '⚠️ **AIニュース通知エラー**\n\n';
    message += `エラー: ${error.message}\n`;

    if (error.stack) {
      const stack = error.stack.split('\n').slice(0, 3).join('\n');
      message += `\`\`\`\n${stack}\n\`\`\``;
    }

    return message;
  }

  /**
   * Sleep for specified milliseconds
   */
  async _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Validate webhook URL
   */
  static isValidWebhookUrl(url) {
    if (!url || typeof url !== 'string') {
      return false;
    }

    try {
      const parsed = new URL(url);
      return (
        parsed.hostname === 'discord.com' &&
        parsed.pathname.startsWith('/api/webhooks/')
      );
    } catch {
      return false;
    }
  }
}
