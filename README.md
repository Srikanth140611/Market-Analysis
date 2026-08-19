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

## Android Studio Workflow (Recommended)

This project is Expo + React Native, so a practical setup is:
- Use VS Code for code changes
- Use Android Studio emulator/device for real Android validation

### 1. Start backend API

```powershell
npm run dev:api
```

### 2. Run on Android emulator via native build

```powershell
npm run dev:android
```

Use this when you want Android-native behavior validation (performance, networking, notifications, release-like behavior).

### 3. Fast iteration using Expo Go on emulator

```powershell
npm run dev:android-go
```

### 4. API base URL behavior

`mobile/src/constants.ts` now defaults automatically to:
- Android: `http://10.0.2.2:8080`
- Web/iOS: `http://localhost:8080`

You can override in any environment using:

```powershell
$env:EXPO_PUBLIC_API_BASE_URL="http://<YOUR_LAN_IP>:8080"
```

Then run app commands in the same terminal session.

### 5. Pre-release Android checklist

- Verify Updates, Trends, Best Shares render without fallback regressions
- Verify fullscreen forex chart interactions on emulator/device
- Verify Slack test notification from app settings
- Verify API `/health` and `/api/news/global` responsiveness under polling
- Build once with `npm run dev:android` after cleaning emulator cache if needed

## Figma Design Handoff

If you share your Figma frame specs (spacing, typography, colors, component states), we can map them 1:1 into this codebase quickly. In this environment I can implement from exported tokens/spec screenshots and keep the React Native styles consistent across web + Android.

## Notes

- No API keys? The app still works with curated fallback sample data.
- Slack notifications require `SLACK_WEBHOOK_URL`.
- Automatic Slack news broadcasts are deduplicated by news ID and only trigger for newly detected headlines after startup.
- This implementation is a production-ready starter and can be extended with broker integrations, watchlists, and user auth.
