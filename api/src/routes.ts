import { Router } from "express";
import { z } from "zod";
import { getForexCandles, getMarketTrends } from "./services/marketService.js";
import { getGlobalMarketNews } from "./services/newsService.js";
import { getNewsNotifierStatus } from "./services/newsNotifierService.js";
import { sendSlackNotification } from "./services/slackService.js";
import { getBestShares } from "./services/stockRecommendationService.js";

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

export const router = Router();

router.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString()
  });
});

router.get("/api/news/global", async (_req, res) => {
  const news = await getGlobalMarketNews();
  res.json(news);
});

router.get("/api/market/trends", async (_req, res) => {
  const trends = await getMarketTrends();
  res.json(trends);
});

router.get("/api/market/best-shares", async (_req, res) => {
  const shares = await getBestShares();
  res.json({ data: shares });
});

router.post("/api/market/forex-candles", async (req, res) => {
  const parsed = forexCandlesSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid payload",
      details: parsed.error.flatten()
    });
  }

  const candles = await getForexCandles(parsed.data.pairs, parsed.data.timeframe, parsed.data.years);
  return res.json(candles);
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
