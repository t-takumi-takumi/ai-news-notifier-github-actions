#!/usr/bin/env node

import { HackerNewsFetcher } from './fetchers/HackerNewsFetcher.js';
import { QiitaFetcher } from './fetchers/QiitaFetcher.js';
import { ZennFetcher } from './fetchers/ZennFetcher.js';
import { getDeduplicationService } from './services/DeduplicationService.js';
import { DiscordNotifier } from './services/DiscordNotifier.js';
import { MessageFormatter } from './utils/MessageFormatter.js';
import { getGeminiService } from './services/GeminiService.js';
import { getLogger } from './utils/Logger.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse CLI arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isVerbose = args.includes('--verbose');

// Initialize logger
const logger = getLogger(isVerbose ? 'DEBUG' : 'INFO');

/**
 * Main application
 */
async function main() {
  const startTime = Date.now();
  logger.info('Starting AI News Notifier', 'main');

  try {
    // Load configuration
    const sourcesConfig = loadSourcesConfig();
    logger.info(`Loaded configuration for ${Object.keys(sourcesConfig.sources).length} sources`, 'main');

    // Initialize fetchers
    const fetchers = {
      hackernews: new HackerNewsFetcher(sourcesConfig.sources.hackernews),
      qiita: new QiitaFetcher(sourcesConfig.sources.qiita),
      zenn: new ZennFetcher(sourcesConfig.sources.zenn)
    };

    // Fetch all articles in parallel
    logger.info('Fetching articles from all sources...', 'main');
    const fetchResults = await Promise.allSettled([
      fetchers.hackernews.fetch(),
      fetchers.qiita.fetch(),
      fetchers.zenn.fetch()
    ]);

    // Collect results
    const articlesBySource = {
      hackernews: [],
      qiita: [],
      zenn: []
    };

    const totalFetched = { hackernews: 0, qiita: 0, zenn: 0 };
    const errors = [];

    for (const [index, result] of fetchResults.entries()) {
      const sourceKey = Object.keys(articlesBySource)[index];

      if (result.status === 'fulfilled' && result.value?.articles) {
        articlesBySource[sourceKey] = result.value.articles;
        totalFetched[sourceKey] = result.value.itemCount || 0;

        if (result.value.failedCount > 0) {
          errors.push(`${sourcesConfig.sources[sourceKey].name}: ${result.value.failedCount} feeds failed`);
        }
      } else {
        errors.push(`${sourcesConfig.sources[sourceKey].name}: ${result.reason?.message || 'Unknown error'}`);
      }
    }

    const totalItems = Object.values(totalFetched).reduce((sum, count) => sum + count, 0);
    logger.info(`Fetched ${totalItems} items total`, 'main');

    // Log any errors
    if (errors.length > 0) {
      logger.warn(`Some sources had errors: ${errors.join(', ')}`, 'main');
    }

    // Filter out seen articles
    const dedupeService = getDeduplicationService();
    const newArticlesBySource = {};

    for (const [sourceKey, articles] of Object.entries(articlesBySource)) {
      if (articles.length > 0) {
        const newArticles = await dedupeService.filterNew(articles);
        // Limit articles per section
        newArticlesBySource[sourceKey] = newArticles.slice(0, sourcesConfig.maxArticlesPerSection);
      }
    }

    // Save updated cache
    await dedupeService.save();

    // Generate AI summaries for new articles
    const geminiService = getGeminiService();
    if (geminiService.isEnabled()) {
      logger.info('Generating AI summaries...', 'main');
      for (const [sourceKey, articles] of Object.entries(newArticlesBySource)) {
        if (articles.length > 0) {
          newArticlesBySource[sourceKey] = await geminiService.summarizeBatch(articles);
        }
      }
    } else {
      logger.info('Gemini service not enabled, skipping summaries', 'main');
    }

    // Cleanup old cache entries
    await dedupeService.cleanup();

    const totalNew = Object.values(newArticlesBySource).reduce((sum, articles) => sum + articles.length, 0);
    logger.info(`Found ${totalNew} new articles`, 'main');

    // Format messages
    const formatter = new MessageFormatter(sourcesConfig.sources);

    if (totalNew === 0) {
      logger.info('No new articles to send', 'main');
      return;
    }

    if (isDryRun) {
      // Dry run: just print what would be sent
      const message = formatter.formatDryRun(newArticlesBySource);
      console.log('\n' + message + '\n');
      logger.info('Dry run completed, no notifications sent', 'main');
      return;
    }

    // Send to Discord
    const messages = formatter.format(newArticlesBySource, totalItems);
    logger.info(`Sending ${messages.length} message(s) to Discord`, 'main');

    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) {
      throw new Error('DISCORD_WEBHOOK_URL environment variable is not set');
    }

    const notifier = new DiscordNotifier(webhookUrl);
    await notifier.send(messages);

    // Log summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.info(`Completed in ${duration}s (${totalNew} articles sent)`, 'main');

  } catch (error) {
    logger.error('Fatal error in main', error, 'main');

    // Try to send error notification
    try {
      const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
      if (webhookUrl && !isDryRun) {
        const notifier = new DiscordNotifier(webhookUrl);
        await notifier.sendError(error);
      }
    } catch (notifyError) {
      // Ignore notification errors
    }

    process.exit(1);
  }
}

/**
 * Load sources configuration
 */
function loadSourcesConfig() {
  const configPath = path.join(__dirname, '../config/sources.json');
  const configContent = readFileSync(configPath, 'utf-8');
  return JSON.parse(configContent);
}

// Run main
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
