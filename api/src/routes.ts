import { Response, Router } from "express";
import { z } from "zod";
import { getForexCandles, getMarketTrends } from "./services/marketService.js";
import { getMarketHistory } from "./services/marketHistoryService.js";
import { getMarketAgentsAnalysis } from "./services/marketAgentService.js";
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
  timeframes: z.array(z.enum(["1minute", "5minute", "1hour", "4hour", "8hour", "12hour", "1Day", "1Week"])).min(1),
  years: z.coerce.number().int().min(1).max(10).optional().default(5)
});

export const router = Router();

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
