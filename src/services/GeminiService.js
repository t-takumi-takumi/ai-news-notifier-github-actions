import { GoogleGenerativeAI } from '@google/generative-ai';
import { GEMINI_CONFIG } from '../../config/constants.js';
import { getLogger } from '../utils/Logger.js';

const logger = getLogger();

/**
 * Gemini API service for article summarization and translation
 */
export class GeminiService {
  constructor(apiKey = null) {
    const key = apiKey || process.env.GEMINI_API_KEY;
    if (!key) {
      logger.warn('GEMINI_API_KEY not set, summaries will be skipped', 'GeminiService');
      this.enabled = false;
      return;
    }

    try {
      const genAI = new GoogleGenerativeAI(key);
      this.model = genAI.getGenerativeModel({
        model: GEMINI_CONFIG.model,
        generationConfig: {
          temperature: GEMINI_CONFIG.temperature,
          maxOutputTokens: 1000,
        }
      });
      this.enabled = true;
      logger.info('Gemini service initialized', 'GeminiService');
    } catch (error) {
      logger.error('Failed to initialize Gemini service', error, 'GeminiService');
      this.enabled = false;
    }
  }

  /**
   * Check if text contains Japanese characters
   */
  _isJapanese(text) {
    if (!text) return false;
    // Check for Hiragana, Katakana, or CJK characters
    return /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text);
  }

  /**
   * Detect article language based on title and content
   */
  _detectLanguage(article) {
    const title = article.title || '';
    const summary = article.summary || '';

    if (this._isJapanese(title) || this._isJapanese(summary)) {
      return 'ja';
    }
    return 'en';
  }

  /**
   * Build prompt for summarization/translation
   */
  _buildPrompt(article, targetLanguage) {
    const isJapanese = this._isJapanese(article.title);
    const maxLength = GEMINI_CONFIG.maxSummaryLength;

    if (isJapanese && targetLanguage === 'ja') {
      // Japanese article, summarize in Japanese
      return `あなたはニュース記事の要約アシスタントです。以下の記事を${maxLength}文字程度で日本語で要約してください。

タイトル: ${article.title}
${article.summary ? `内容概要: ${article.summary}` : ''}

要約（重要なポイントを${maxLength}文字以内で簡潔にまとめてください）:`;
    } else if (!isJapanese && targetLanguage === 'ja') {
      // English article, translate title and summarize in Japanese
      return `あなたはニュース記事の要約・翻訳アシスタントです。以下の英語記事を処理してください。

タスク:
1. タイトルを日本語に翻訳
2. 記事の内容を${maxLength}文字程度で日本語で要約

Title: ${article.title}
${article.summary ? `Content: ${article.summary}` : ''}

以下の形式で正確に出力してください:
TITLE: 翻訳されたタイトル
SUMMARY: 要約文`;
    } else {
      // Default: summarize in original language
      return `Summarize the following article in ${maxLength} characters.

Title: ${article.title}
${article.summary ? `Content: ${article.summary}` : ''}

Summary:`;
    }
  }

  /**
   * Parse Gemini response to extract translated title and summary
   */
  _parseResponse(response, originalLanguage) {
    const text = response.trim();

    if (originalLanguage === 'en') {
      // Try to parse TITLE: and SUMMARY: format first
      const titleMatch = text.match(/TITLE:\s*(.+?)(?:\n|$)/i);
      const summaryMatch = text.match(/SUMMARY:\s*(.+?)(?:\n*$|$)/is);

      if (titleMatch && summaryMatch) {
        return {
          translatedTitle: titleMatch[1].trim(),
          summary: summaryMatch[1].trim()
        };
      }

      // Fallback: split by lines
      const lines = text.split('\n').map(l => l.trim()).filter(l => l);
      if (lines.length >= 2) {
        return {
          translatedTitle: lines[0],
          summary: lines.slice(1).join('\n')
        };
      } else if (lines.length === 1) {
        return {
          translatedTitle: null,
          summary: lines[0]
        };
      }
      return {
        translatedTitle: null,
        summary: null
      };
    }

    // Japanese article: everything is summary
    return {
      translatedTitle: null,
      summary: text || null
    };
  }

  /**
   * Summarize a single article
   */
  async summarizeArticle(article, targetLanguage = 'ja') {
    if (!this.enabled) {
      return { translatedTitle: null, summary: null };
    }

    const context = `GeminiService.summarize(${article.source})`;

    try {
      const detectedLanguage = this._detectLanguage(article);
      const prompt = this._buildPrompt(article, targetLanguage);

      logger.debug(`Summarizing article: ${article.title.slice(0, 30)}...`, context);
      logger.debug(`Detected language: ${detectedLanguage}`, context);

      const result = await this.model.generateContent(prompt);
      const response = result.response.text();

      logger.debug(`Gemini raw response: "${response}"`, context);

      const parsed = this._parseResponse(response, detectedLanguage);

      logger.debug(`Parsed - title: "${parsed.translatedTitle}", summary: "${parsed.summary}"`, context);

      return parsed;
    } catch (error) {
      logger.warn(`Failed to summarize article: ${error.message}`, context);
      return { translatedTitle: null, summary: null };
    }
  }

  /**
   * Summarize multiple articles in batches
   */
  async summarizeBatch(articles, targetLanguage = 'ja') {
    if (!this.enabled || articles.length === 0) {
      return articles;
    }

    const batchSize = GEMINI_CONFIG.batchSize;

    logger.info(`Summarizing ${articles.length} articles in batches of ${batchSize}`, 'GeminiService');

    for (let i = 0; i < articles.length; i += batchSize) {
      const batch = articles.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(articles.length / batchSize);

      logger.info(`Processing batch ${batchNum}/${totalBatches}`, 'GeminiService');

      // Process batch in parallel
      await Promise.all(
        batch.map(async (article) => {
          const { translatedTitle, summary } = await this.summarizeArticle(article, targetLanguage);
          article.setAiSummary(summary);
          if (translatedTitle) {
            article.setTranslatedTitle(translatedTitle);
          }
        })
      );

      // Small delay between batches to avoid rate limiting
      if (i + batchSize < articles.length) {
        await this._sleep(500);
      }
    }

    logger.info(`Completed summarizing ${articles.length} articles`, 'GeminiService');
    return articles;
  }

  /**
   * Sleep for specified milliseconds
   */
  async _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if service is enabled
   */
  isEnabled() {
    return this.enabled;
  }
}

// Singleton instance
let geminiServiceInstance = null;

export function getGeminiService() {
  if (!geminiServiceInstance) {
    geminiServiceInstance = new GeminiService();
  }
  return geminiServiceInstance;
}
