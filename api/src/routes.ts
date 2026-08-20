import { Response, Router } from "express";
import { z } from "zod";
import { config } from "./config.js";
import { getForexCandles, getMarketTrends } from "./services/marketService.js";
import { getMarketHistory } from "./services/marketHistoryService.js";
import {
  getForexTradeMonitoringHistoryReport,
  getForexTradeMonitoringReport,
  getMarketAgentsAnalysis,
  type ForexTradeMonitoringHistoryReport,
  type ForexTradeMonitoringReport
} from "./services/marketAgentService.js";
import { getLatestMt4Snapshot, storeMt4Snapshot } from "./services/mt4Service.js";
import { getGlobalMarketNews } from "./services/newsService.js";
import { getNewsNotifierStatus } from "./services/newsNotifierService.js";
import { sendSlackNotification } from "./services/slackService.js";
import { getBestShares } from "./services/stockRecommendationService.js";
import { isLiveDataUnavailableError } from "./liveData.js";

const slackSchema = z.object({
  message: z.string().min(3),
  blocks: z
    .array(
      z.object({
        type: z.literal("section"),
        text: z.object({
          type: z.literal("mrkdwn"),
          text: z.string()
        })
      })
    )
    .optional()
});

const forexCandlesSchema = z.object({
  pairs: z.array(z.string().min(3)).min(1),
  timeframe: z.enum(["1minute", "5minute", "1hour", "4hour", "1Day", "1Week", "1Month", "3Months", "1Year"]),
  years: z.coerce.number().int().min(1).max(10).optional().default(5)
});

const marketHistorySchema = z.object({
  symbols: z.array(z.string().min(2)).min(1),
  timeframes: z.array(z.enum(["1hour", "4hour", "12hour", "1Day", "1Week"])).min(1),
  years: z.coerce.number().int().min(1).max(10).optional().default(5)
});

const mt4SnapshotSchema = z.object({
  accountId: z.string().min(1),
  terminalId: z.string().min(1),
  server: z.string().min(1).optional(),
  timestamp: z.string().datetime().optional().default(() => new Date().toISOString()),
  heartbeat: z.coerce.number().int().nonnegative().optional(),
  balance: z.coerce.number().optional(),
  equity: z.coerce.number().optional(),
  margin: z.coerce.number().optional(),
  freeMargin: z.coerce.number().optional(),
  positions: z
    .array(
      z.object({
        symbol: z.string().min(1),
        side: z.enum(["BUY", "SELL"]),
        volume: z.coerce.number().positive(),
        openPrice: z.coerce.number().positive(),
        profit: z.coerce.number(),
        stopLoss: z.coerce.number().positive().optional(),
        takeProfit: z.coerce.number().positive().optional()
      })
    )
    .optional(),
  pendingOrders: z
    .array(
      z.object({
        symbol: z.string().min(1),
        type: z.enum(["BUY_LIMIT", "BUY_STOP", "SELL_LIMIT", "SELL_STOP"]),
        price: z.coerce.number().positive(),
        volume: z.coerce.number().positive(),
        stopLoss: z.coerce.number().positive().optional(),
        takeProfit: z.coerce.number().positive().optional()
      })
    )
    .optional(),
  quotes: z
    .array(
      z.object({
        symbol: z.string().min(1),
        bid: z.coerce.number().positive(),
        ask: z.coerce.number().positive(),
        spread: z.coerce.number().positive().optional(),
        timestamp: z.string().datetime()
      })
    )
    .optional()
});

export const router = Router();

function escapeHtml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatNumber(value: number, decimals = 2) {
  if (!Number.isFinite(value)) {
    return "-";
  }

  return value.toFixed(decimals);
}

function wantsHtmlResponse(acceptHeader: string | undefined, formatQuery: unknown) {
  if (typeof formatQuery === "string" && formatQuery.toLowerCase() === "html") {
    return true;
  }

  return typeof acceptHeader === "string" && acceptHeader.includes("text/html");
}

function renderMonitoringReportHtml(report: ForexTradeMonitoringReport) {
  const rows = report.items
    .map((item) => {
      const statusClass = item.status === "tp-hit" ? "tp" : item.status === "sl-hit" ? "sl" : "open";
      return `<tr>
        <td>${escapeHtml(item.tradeId)}</td>
        <td>${escapeHtml(item.symbol)}</td>
        <td>${escapeHtml(item.timeframe)}</td>
        <td>${escapeHtml(item.direction.toUpperCase())}</td>
        <td>${formatNumber(item.entry, 4)}</td>
        <td>${formatNumber(item.stopLoss, 4)}</td>
        <td>${formatNumber(item.takeProfit, 4)}</td>
        <td>${formatNumber(item.currentPrice, 4)}</td>
        <td>1:${formatNumber(item.riskRewardRatio, 2)}</td>
        <td class="${statusClass}">${escapeHtml(item.status.toUpperCase())}</td>
        <td>${escapeHtml(item.openedAt)}</td>
        <td>${item.closedAt ? escapeHtml(item.closedAt) : "-"}</td>
      </tr>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Forex Trade Monitoring Report</title>
  <style>
    :root { color-scheme: light; }
    body { font-family: "Segoe UI", Tahoma, sans-serif; margin: 0; background: #f4f8fb; color: #102132; }
    .wrap { max-width: 1200px; margin: 0 auto; padding: 20px; }
    h1 { margin: 0 0 8px; font-size: 24px; }
    .meta { color: #466176; margin-bottom: 14px; }
    .stats { display: grid; grid-template-columns: repeat(auto-fill,minmax(170px,1fr)); gap: 10px; margin-bottom: 16px; }
    .stat { background: #ffffff; border: 1px solid #d7e3ec; border-radius: 10px; padding: 10px; }
    .stat .k { display: block; color: #4d6477; font-size: 12px; margin-bottom: 3px; }
    .stat .v { font-size: 20px; font-weight: 700; color: #0b2f4a; }
    table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #d7e3ec; }
    th, td { text-align: left; padding: 8px; border-bottom: 1px solid #edf2f6; font-size: 12px; }
    th { background: #f0f6fb; color: #26435c; position: sticky; top: 0; }
    .tp { color: #166534; font-weight: 700; }
    .sl { color: #b91c1c; font-weight: 700; }
    .open { color: #9a6700; font-weight: 700; }
    .table-wrap { overflow: auto; border-radius: 10px; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Forex Trade Monitoring Report</h1>
    <div class="meta">Generated at ${escapeHtml(report.generatedAt)}</div>
    <div class="meta">Monitoring day ${escapeHtml(report.monitoringDayKey)} | Time zone ${escapeHtml(report.monitoringTimeZone)} | Confidence threshold &ge; ${report.confidenceThreshold}%</div>
    <section class="stats">
      <div class="stat"><span class="k">Total Trades</span><span class="v">${report.totalTrades}</span></div>
      <div class="stat"><span class="k">TP Hit</span><span class="v">${report.tpHitCount}</span></div>
      <div class="stat"><span class="k">SL Hit</span><span class="v">${report.slHitCount}</span></div>
      <div class="stat"><span class="k">Open</span><span class="v">${report.openCount}</span></div>
      <div class="stat"><span class="k">Resolved</span><span class="v">${report.resolvedTrades}</span></div>
      <div class="stat"><span class="k">Win Rate</span><span class="v">${formatNumber(report.winRatePercent)}%</span></div>
    </section>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Trade ID</th>
            <th>Symbol</th>
            <th>Timeframe</th>
            <th>Direction</th>
            <th>Entry</th>
            <th>SL</th>
            <th>TP</th>
            <th>Current</th>
            <th>R:R</th>
            <th>Status</th>
            <th>Opened</th>
            <th>Closed</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  </div>
</body>
</html>`;
}

function renderMonitoringHistoryHtml(report: ForexTradeMonitoringHistoryReport) {
  const rows = report.daily
    .map((day) => `<tr>
      <td>${escapeHtml(day.date)}</td>
      <td>${day.hasData ? "Yes" : "No"}</td>
      <td>${day.openedTrades}</td>
      <td>${day.totalTrades}</td>
      <td>${day.tpHitCount}</td>
      <td>${day.slHitCount}</td>
      <td>${day.openCount}</td>
      <td>${day.resolvedTrades}</td>
      <td>${day.winRatePercent == null ? "-" : `${formatNumber(day.winRatePercent)}%`}</td>
    </tr>`)
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>10-Day Forex Success Rate View</title>
  <style>
    :root { color-scheme: light; }
    body { font-family: "Segoe UI", Tahoma, sans-serif; margin: 0; background: #f4f8fb; color: #102132; }
    .wrap { max-width: 1100px; margin: 0 auto; padding: 20px; }
    h1 { margin: 0 0 8px; font-size: 24px; }
    .meta { color: #466176; margin-bottom: 14px; }
    .stats { display: grid; grid-template-columns: repeat(auto-fill,minmax(180px,1fr)); gap: 10px; margin-bottom: 16px; }
    .stat { background: #ffffff; border: 1px solid #d7e3ec; border-radius: 10px; padding: 10px; }
    .stat .k { display: block; color: #4d6477; font-size: 12px; margin-bottom: 3px; }
    .stat .v { font-size: 20px; font-weight: 700; color: #0b2f4a; }
    table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #d7e3ec; }
    th, td { text-align: left; padding: 8px; border-bottom: 1px solid #edf2f6; font-size: 12px; }
    th { background: #f0f6fb; color: #26435c; }
    .table-wrap { overflow: auto; border-radius: 10px; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>10-Day Forex Success Rate View</h1>
    <div class="meta">Generated at ${escapeHtml(report.generatedAt)}</div>
    <section class="stats">
      <div class="stat"><span class="k">Days Requested</span><span class="v">${report.daysRequested}</span></div>
      <div class="stat"><span class="k">Observed Days</span><span class="v">${report.observedDays}</span></div>
      <div class="stat"><span class="k">Total TP Hit</span><span class="v">${report.totalTpHitCount}</span></div>
      <div class="stat"><span class="k">Total SL Hit</span><span class="v">${report.totalSlHitCount}</span></div>
      <div class="stat"><span class="k">Resolved Trades</span><span class="v">${report.totalResolvedTrades}</span></div>
      <div class="stat"><span class="k">Overall Win Rate</span><span class="v">${report.overallWinRatePercent == null ? "-" : `${formatNumber(report.overallWinRatePercent)}%`}</span></div>
    </section>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Has Data</th>
            <th>Opened</th>
            <th>Total</th>
            <th>TP Hit</th>
            <th>SL Hit</th>
            <th>Open</th>
            <th>Resolved</th>
            <th>Win Rate</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  </div>
</body>
</html>`;
}

function handleRouteError(res: Response, error: unknown) {
  if (isLiveDataUnavailableError(error)) {
    return res.status(error.statusCode).json({
      error: error.message,
      details: error.details,
      source: "live-only"
    });
  }

  return res.status(500).json({
    error: error instanceof Error ? error.message : "Internal server error"
  });
}

router.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString()
  });
});

router.get("/api/news/global", async (_req, res) => {
  try {
    const news = await getGlobalMarketNews();
    res.json(news);
  } catch (error) {
    return handleRouteError(res, error);
  }
});

router.get("/api/market/trends", async (_req, res) => {
  try {
    const trends = await getMarketTrends();
    res.json(trends);
  } catch (error) {
    return handleRouteError(res, error);
  }
});

router.get("/api/market/best-shares", async (_req, res) => {
  try {
    const shares = await getBestShares();
    res.json({ data: shares });
  } catch (error) {
    return handleRouteError(res, error);
  }
});

router.post("/api/market/forex-candles", async (req, res) => {
  const parsed = forexCandlesSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid payload",
      details: parsed.error.flatten()
    });
  }

  try {
    const candles = await getForexCandles(parsed.data.pairs, parsed.data.timeframe, parsed.data.years);
    return res.json(candles);
  } catch (error) {
    return handleRouteError(res, error);
  }
});

router.post("/api/market/history", async (req, res) => {
  const parsed = marketHistorySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid payload",
      details: parsed.error.flatten()
    });
  }

  try {
    const history = await getMarketHistory(parsed.data.symbols, parsed.data.timeframes, parsed.data.years);
    return res.json(history);
  } catch (error) {
    return handleRouteError(res, error);
  }
});

router.get("/api/market/agents", async (_req, res) => {
  try {
    const agents = await getMarketAgentsAnalysis();
    return res.json(agents);
  } catch (error) {
    return handleRouteError(res, error);
  }
});

router.get("/api/market/forex-monitoring-report", async (req, res) => {
  try {
    const report = await getForexTradeMonitoringReport();
    if (wantsHtmlResponse(req.header("accept"), req.query.format)) {
      return res.type("html").send(renderMonitoringReportHtml(report));
    }

    return res.json(report);
  } catch (error) {
    return handleRouteError(res, error);
  }
});

router.get("/api/market/forex-monitoring-history", async (req, res) => {
  const parsedDays = Number(req.query.days);
  const days = Number.isFinite(parsedDays) ? parsedDays : 10;

  try {
    const report = await getForexTradeMonitoringHistoryReport(days);
    if (wantsHtmlResponse(req.header("accept"), req.query.format)) {
      return res.type("html").send(renderMonitoringHistoryHtml(report));
    }

    return res.json(report);
  } catch (error) {
    return handleRouteError(res, error);
  }
});

router.get("/api/mt4/snapshot", (_req, res) => {
  const snapshot = getLatestMt4Snapshot();
  if (!snapshot) {
    return res.status(404).json({
      error: "No MT4 snapshot received yet"
    });
  }

  return res.json(snapshot);
});

router.get("/api/mt4/quotes", (_req, res) => {
  const snapshot = getLatestMt4Snapshot();
  if (!snapshot) {
    return res.status(404).json({
      error: "No MT4 snapshot received yet"
    });
  }

  return res.json({
    source: snapshot.source,
    receivedAt: snapshot.receivedAt,
    timestamp: snapshot.timestamp,
    heartbeat: snapshot.heartbeat,
    ageSeconds: snapshot.ageSeconds,
    healthStatus: snapshot.healthStatus,
    healthNote: snapshot.healthNote,
    quotes: snapshot.quotes ?? []
  });
});

router.post("/api/mt4/snapshot", (req, res) => {
  if (config.MT4_SNAPSHOT_API_KEY) {
    const providedKey = req.header("x-api-key") ?? "";
    if (providedKey !== config.MT4_SNAPSHOT_API_KEY) {
      return res.status(401).json({
        error: "Unauthorized"
      });
    }
  }

  const parsed = mt4SnapshotSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid payload",
      details: parsed.error.flatten()
    });
  }

  return res.status(202).json(storeMt4Snapshot(parsed.data));
});

router.get("/api/notify/status", (_req, res) => {
  res.json(getNewsNotifierStatus());
});

router.post("/api/notify/slack", async (req, res) => {
  const parsed = slackSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid payload",
      details: parsed.error.flatten()
    });
  }

  try {
    await sendSlackNotification(parsed.data.message, parsed.data.blocks);
    return res.status(202).json({ status: "queued" });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to send Slack notification"
    });
  }
});
