# Market Analysis Mobile App

A mobile-first market analysis platform with:
- Global live market updates/news feed
- Trend analysis for forex, commodities, and oil
- Best-share suggestions based on momentum
- Slack notification push for actionable alerts
- Automatic Slack broadcast for newly detected market news

## Architecture

- `mobile/`: Expo React Native app
- `api/`: Node.js + Express API for market/news integration and Slack webhook notifications

The mobile app polls the API every 60 seconds for updated data.

## Features Delivered

1. Global updated section for market news
2. Market trend dashboard for:
   - Forex pairs
   - Commodities (gold)
   - Oil
3. Best share suggestions section
4. Slack notification trigger from app settings
5. Graceful fallback data when external provider keys are not configured
6. Auto-news to Slack for all configured webhook targets

## API Endpoints

- `GET /health`
- `GET /api/news/global`
- `GET /api/market/trends`
- `GET /api/market/best-shares`
- `GET /api/notify/status`
- `POST /api/notify/slack`

Slack payload example:

```json
{
  "message": "Alert: Gold breakout above resistance",
  "blocks": [
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*Market Alert*\nGold breakout above resistance"
      }
    }
  ]
}
```

## Setup

### 1. Install dependencies

```powershell
npm install
```

### 2. Configure API environment

```powershell
Copy-Item api/.env.example api/.env
```

Update `api/.env` with your keys:
- `MARKETAUX_API_KEY`
- `FINNHUB_API_KEY`
- `ALPHA_VANTAGE_API_KEY`
- `SLACK_WEBHOOK_URL`
- Optional: `SLACK_WEBHOOK_URLS` (comma-separated additional webhook URLs)
- Optional: `SLACK_NOTIFY_USER_IDS` (comma-separated Slack user IDs to mention)
- Optional: `AUTO_NEWS_TO_SLACK_ENABLED` (`true`/`false`, default `true`)
- Optional: `NEWS_POLL_INTERVAL_MS` (default `60000`)

### 3. Run API

```powershell
npm run dev:api
```

### 4. Run Mobile app (separate terminal)

```powershell
npm run dev:mobile
```

For Android emulator or device, update `mobile/src/constants.ts` API base URL from localhost to your machine LAN IP if needed.

## Notes

- No API keys? The app still works with curated fallback sample data.
- Slack notifications require `SLACK_WEBHOOK_URL`.
- Automatic Slack news broadcasts are deduplicated by news ID and only trigger for newly detected headlines after startup.
- This implementation is a production-ready starter and can be extended with broker integrations, watchlists, and user auth.
