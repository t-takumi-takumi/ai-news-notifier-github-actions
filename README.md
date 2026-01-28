# AI News Notifier (GitHub Actions)

GitHub Actions で毎日自動実行され、Hacker News / Qiita / Zenn から AI 関連記事を収集して Discord へ通知するシステム。

## 特徴

- 毎日 07:15 JST に自動実行（GitHub Actions スケジュール）
- RSS/Atom フィードから記事を収集
- 重複除外機能（GitHub Actions キャッシュで永続化）
- Discord Webhook で通知
- エラーハンドリング付き（一部ソース失敗でも継続）

## ソース

| ソース | フィード | 最大件数 |
|--------|---------|----------|
| Hacker News | https://hnrss.org/newest | 30件 |
| Qiita | 人気 + AIタグ6種 | 20件 |
| Zenn | トレンド + AIトピック4種 | 20件 |

## セットアップ

### 1. GitHub Secrets の設定

リポジトリの **Settings > Secrets and variables > Actions** で以下の Secret を追加：

| 名前 | 値 |
|------|-----|
| `DISCORD_WEBHOOK_URL` | Discord Webhook URL |

### 2. Discord Webhook の取得

1. Discord サーバーでチャンネル設定 > インテグレーション > Webhook を作成
2. Webhook URL をコピーして GitHub Secrets に設定

### 3. 手動実行（テスト）

GitHub Actions ページから **Daily AI News Notifier** ワークフローを選択し、**Run workflow** をクリック。

## ローカル実行

```bash
# 依存インストール
npm install

# .env ファイル作成
echo "DISCORD_WEBHOOK_URL=your_webhook_url" > .env

# Dry run（通知なし）
npm run dry-run

# 実行
npm start
```

## 設定ファイル

### `config/sources.json`

RSS フィード URL やタグを追加・変更できます。

```json
{
  "sources": {
    "qiita": {
      "feeds": [
        "https://qiita.com/tags/llm/feed.atom",
        "https://qiita.com/tags/python/feed.atom"  // 追加例
      ]
    }
  }
}
```

### `config/constants.js`

- `maxArticlesPerSection`: セクションあたりの最大記事数（デフォルト: 8件）
- `cacheRetentionDays`: キャッシュ保持日数（デフォルト: 30日）

## 通知フォーマット

```
📰 **AIニュースまとめ** (2026/01/28)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔶 **Hacker News** (5件)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. GPT-5の発表が近日中に
   📅 01/28 06:30
   🔗 https://news.ycombinator.com/item?id=12345

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 **集計**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
全ソース: 70件取得 / 新着: 15件
```

## エラーハンドリング

- 一部ソースの取得失敗は全体に影響しません
- 失敗したソースはログに記録されます
- Webhook 送信失敗時はエラー通知が送信されます

## 今後の改良ポイント

- **AI要約機能**: Claude / OpenAI API 連携で日本語要約を生成
- **URL正規化強化**: クエリパラメータのより高度な処理
- **スコアリング**: 記事の優先順位付け（いいね数、コメント数等）
- **キーワードフィルタリング**: 特定キーワードで記事をフィルタ
- **複数Webhook対応**: 異なるチャンネルへの送信
- **通知時刻可変化**: 複数時刻での通知
- **要約機能の差し替え**: `summarize()` 関数をモジュール化して実装

## ライセンス

MIT
