import { config } from "../config.js";
import { throwLiveDataUnavailable } from "../liveData.js";

export type StockSuggestion = {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
  source?: "live" | "fallback";
  rationale: string;
  sector?: string;
  score?: number;
  factorScores?: {
    momentum: number;
    volatility: number;
    sentiment: number;
    participation: number;
  };
};

const fallbackSuggestions: StockSuggestion[] = [
  {
    symbol: "MSFT",
    name: "Microsoft Corp",
    price: 431.2,
    changePercent: 1.92,
    source: "fallback",
    sector: "Technology",
    rationale: "Strong earnings momentum and sustained institutional buying pressure.",
    score: 82,
    factorScores: {
      momentum: 81,
      volatility: 72,
      sentiment: 80,
      participation: 79
    }
  },
  {
    symbol: "NVDA",
    name: "NVIDIA Corp",
    price: 128.6,
    changePercent: 2.33,
    source: "fallback",
    sector: "Semiconductors",
    rationale: "High relative strength and leadership in AI infrastructure demand.",
    score: 87,
    factorScores: {
      momentum: 90,
      volatility: 76,
      sentiment: 85,
      participation: 84
    }
  },
  {
    symbol: "XOM",
    name: "Exxon Mobil Corp",
    price: 116.74,
    changePercent: 1.14,
    source: "fallback",
    sector: "Energy",
    rationale: "Oil price resilience and stable cash flow support the trend continuation.",
    score: 79,
    factorScores: {
      momentum: 77,
      volatility: 74,
      sentiment: 79,
      participation: 72
    }
  }
];

const TOP_SHARES_COUNT = 20;

type UniverseStock = {
  symbol: string;
  name: string;
  sector: string;
};

type FinnhubQuote = {
  c: number;
  dp: number;
  h: number;
  l: number;
  pc: number;
};

type FinnhubSentiment = {
  sentiment?: {
    companyNewsScore?: number;
    bullishPercent?: number;
    bearishPercent?: number;
  };
  buzz?: {
    buzz?: number;
    weeklyAverage?: number;
  };
};

type YahooQuoteResult = {
  symbol?: string;
  regularMarketPrice?: number;
  regularMarketChangePercent?: number;
};

const universe: UniverseStock[] = [
  { symbol: "MSFT", name: "Microsoft Corp", sector: "Technology" },
  { symbol: "NVDA", name: "NVIDIA Corp", sector: "Semiconductors" },
  { symbol: "AAPL", name: "Apple Inc", sector: "Technology" },
  { symbol: "AMZN", name: "Amazon.com Inc", sector: "Consumer" },
  { symbol: "GOOGL", name: "Alphabet Inc", sector: "Technology" },
  { symbol: "META", name: "Meta Platforms", sector: "Technology" },
  { symbol: "TSLA", name: "Tesla Inc", sector: "Automotive" },
  { symbol: "JPM", name: "JPMorgan Chase", sector: "Financials" },
  { symbol: "XOM", name: "Exxon Mobil Corp", sector: "Energy" },
  { symbol: "CVX", name: "Chevron Corp", sector: "Energy" },
  { symbol: "RIO", name: "Rio Tinto", sector: "Materials" },
  { symbol: "BHP", name: "BHP Group", sector: "Materials" },
  { symbol: "UNH", name: "UnitedHealth Group", sector: "Healthcare" },
  { symbol: "JNJ", name: "Johnson & Johnson", sector: "Healthcare" },
  { symbol: "PG", name: "Procter & Gamble", sector: "Consumer" },
  { symbol: "KO", name: "Coca-Cola Co", sector: "Consumer" },
  { symbol: "PEP", name: "PepsiCo Inc", sector: "Consumer" },
  { symbol: "WMT", name: "Walmart Inc", sector: "Consumer" },
  { symbol: "HD", name: "Home Depot", sector: "Consumer" },
  { symbol: "MCD", name: "McDonald's", sector: "Consumer" },
  { symbol: "ABBV", name: "AbbVie Inc", sector: "Healthcare" },
  { symbol: "LLY", name: "Eli Lilly", sector: "Healthcare" },
  { symbol: "MRK", name: "Merck & Co", sector: "Healthcare" },
  { symbol: "BAC", name: "Bank of America", sector: "Financials" },
  { symbol: "V", name: "Visa Inc", sector: "Financials" },
  { symbol: "MA", name: "Mastercard Inc", sector: "Financials" },
  { symbol: "COST", name: "Costco Wholesale", sector: "Consumer" },
  { symbol: "NFLX", name: "Netflix Inc", sector: "Technology" },
  { symbol: "AMD", name: "Advanced Micro Devices", sector: "Semiconductors" },
  { symbol: "ORCL", name: "Oracle Corp", sector: "Technology" }
];

function rankAndLimit(items: StockSuggestion[], limit = TOP_SHARES_COUNT) {
  return items
    .slice()
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, limit);
}

function mergeUniqueSuggestions(...batches: StockSuggestion[][]) {
  const merged = new Map<string, StockSuggestion>();
  for (const batch of batches) {
    for (const item of batch) {
      if (!merged.has(item.symbol)) {
        merged.set(item.symbol, item);
      }
    }
  }
  return Array.from(merged.values());
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function scoreMomentum(changePercent: number) {
  return clamp(((changePercent + 5) / 10) * 100, 0, 100);
}

function scoreVolatility(rangePercent: number) {
  if (!Number.isFinite(rangePercent) || rangePercent <= 0) {
    return 15;
  }

  if (rangePercent < 1) {
    return 25 + rangePercent * 20;
  }

  if (rangePercent <= 5) {
    return 60 + (rangePercent - 1) * 10;
  }

  if (rangePercent <= 10) {
    return 100 - (rangePercent - 5) * 10;
  }

  return 40;
}

function scoreSentiment(sentiment: number) {
  return clamp((sentiment + 1) * 50, 0, 100);
}

function scoreParticipation(buzz: number, weeklyAverage: number) {
  const ratio = weeklyAverage > 0 ? buzz / weeklyAverage : 0;
  return clamp(ratio * 50, 0, 100);
}

function buildRationale(inputs: {
  momentum: number;
  volatility: number;
  sentiment: number;
  participation: number;
}) {
  const drivers: string[] = [];

  if (inputs.momentum >= 70) {
    drivers.push("strong price momentum");
  }
  if (inputs.sentiment >= 60) {
    drivers.push("positive news sentiment");
  }
  if (inputs.participation >= 60) {
    drivers.push("above-average news participation");
  }
  if (inputs.volatility >= 70) {
    drivers.push("healthy intraday trading range");
  }

  if (drivers.length === 0) {
    return "Balanced technical and sentiment profile with stable trend potential.";
  }

  return `Trend setup supported by ${drivers.join(", ")}.`;
}

async function getAlphaVantageSuggestions(): Promise<StockSuggestion[] | null> {
  if (!config.ALPHA_VANTAGE_API_KEY) {
    return null;
  }

  const url = new URL("https://www.alphavantage.co/query");
  url.searchParams.set("function", "TOP_GAINERS_LOSERS");
  url.searchParams.set("apikey", config.ALPHA_VANTAGE_API_KEY);

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as {
      top_gainers?: Array<{
        ticker: string;
        price: string;
        change_percentage: string;
      }>;
    };

    const picks = (payload.top_gainers ?? []).slice(0, TOP_SHARES_COUNT).map((item) => {
      const change = Number.parseFloat(item.change_percentage.replace("%", ""));
      const price = Number.parseFloat(item.price);

      return {
        symbol: item.ticker,
        name: item.ticker,
        price: Number.isFinite(price) ? price : 0,
        changePercent: Number.isFinite(change) ? change : 0,
        rationale: "Strong upside momentum with elevated participation in current sessions.",
        source: "live",
        score: clamp((Number.isFinite(change) ? change : 0) * 8 + 50, 0, 100),
        factorScores: {
          momentum: clamp((Number.isFinite(change) ? change : 0) * 10 + 50, 0, 100),
          volatility: 62,
          sentiment: 58,
          participation: 64
        }
      } satisfies StockSuggestion;
    });

    return picks.length > 0 ? picks : null;
  } catch {
    return null;
  }
}

async function getYahooSuggestions(): Promise<StockSuggestion[] | null> {
  const url = new URL("https://query1.finance.yahoo.com/v7/finance/quote");
  url.searchParams.set("symbols", universe.map((stock) => stock.symbol).join(","));

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "market-analysis-api"
      }
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as {
      quoteResponse?: {
        result?: YahooQuoteResult[];
      };
    };

    const quoteBySymbol = new Map((payload.quoteResponse?.result ?? []).map((item) => [item.symbol, item]));

    const suggestions = universe
      .map((stock) => {
        const quote = quoteBySymbol.get(stock.symbol);
        const price = quote?.regularMarketPrice;
        const changePercent = quote?.regularMarketChangePercent;

        if (typeof price !== "number" || typeof changePercent !== "number") {
          return null;
        }

        const momentum = scoreMomentum(changePercent);
        const volatility = 58;
        const sentiment = 55;
        const participation = 52;
        const score = momentum * 0.65 + volatility * 0.15 + sentiment * 0.1 + participation * 0.1;

        return {
          symbol: stock.symbol,
          name: stock.name,
          sector: stock.sector,
          price,
          changePercent,
          score: Number(score.toFixed(1)),
          source: "live",
          factorScores: {
            momentum: Number(momentum.toFixed(1)),
            volatility,
            sentiment,
            participation
          },
          rationale: buildRationale({
            momentum,
            volatility,
            sentiment,
            participation
          })
        } satisfies StockSuggestion;
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, TOP_SHARES_COUNT);

    return suggestions.length > 0 ? suggestions : null;
  } catch {
    return null;
  }
}

export async function getBestShares(): Promise<StockSuggestion[]> {
  if (!config.FINNHUB_API_KEY) {
    const [yahoo, alpha] = await Promise.all([getYahooSuggestions(), getAlphaVantageSuggestions()]);
    const merged = rankAndLimit(mergeUniqueSuggestions(yahoo ?? [], alpha ?? [], fallbackSuggestions));
    if (merged.length > 0) {
      return merged;
    }

    if (config.STRICT_LIVE_MODE) {
      throwLiveDataUnavailable(
        "Live best shares unavailable",
        "FINNHUB_API_KEY is not configured, and Yahoo/Alpha Vantage providers are unavailable"
      );
    }

    return fallbackSuggestions;
  }

  try {
    const candidates = await Promise.all(
      universe.map(async (stock) => {
        const quoteUrl = new URL("https://finnhub.io/api/v1/quote");
        quoteUrl.searchParams.set("symbol", stock.symbol);
        quoteUrl.searchParams.set("token", config.FINNHUB_API_KEY!);

        const sentimentUrl = new URL("https://finnhub.io/api/v1/news-sentiment");
        sentimentUrl.searchParams.set("symbol", stock.symbol);
        sentimentUrl.searchParams.set("token", config.FINNHUB_API_KEY!);

        try {
          const [quoteResponse, sentimentResponse] = await Promise.all([
            fetch(quoteUrl),
            fetch(sentimentUrl)
          ]);

          if (!quoteResponse.ok || !sentimentResponse.ok) {
            return null;
          }

          const quote = (await quoteResponse.json()) as FinnhubQuote;
          const sentimentPayload = (await sentimentResponse.json()) as FinnhubSentiment;

          if (!Number.isFinite(quote.c) || !Number.isFinite(quote.dp) || !Number.isFinite(quote.pc)) {
            return null;
          }

          const rangePercent =
            quote.pc > 0 && Number.isFinite(quote.h) && Number.isFinite(quote.l)
              ? ((quote.h - quote.l) / quote.pc) * 100
              : 0;

          const newsSentiment =
            typeof sentimentPayload.sentiment?.companyNewsScore === "number"
              ? sentimentPayload.sentiment.companyNewsScore
              : typeof sentimentPayload.sentiment?.bullishPercent === "number" &&
                  typeof sentimentPayload.sentiment?.bearishPercent === "number"
                ? (sentimentPayload.sentiment.bullishPercent - sentimentPayload.sentiment.bearishPercent) / 100
                : 0;

          const buzz = sentimentPayload.buzz?.buzz ?? 0;
          const weeklyAverage = sentimentPayload.buzz?.weeklyAverage ?? 0;

          const momentum = scoreMomentum(quote.dp);
          const volatility = scoreVolatility(rangePercent);
          const sentiment = scoreSentiment(newsSentiment);
          const participation = scoreParticipation(buzz, weeklyAverage);

          const score =
            momentum * 0.45 +
            volatility * 0.15 +
            sentiment * 0.25 +
            participation * 0.15;

          return {
            symbol: stock.symbol,
            name: stock.name,
            sector: stock.sector,
            price: quote.c,
            changePercent: quote.dp,
            score: Number(score.toFixed(1)),
            source: "live",
            factorScores: {
              momentum: Number(momentum.toFixed(1)),
              volatility: Number(volatility.toFixed(1)),
              sentiment: Number(sentiment.toFixed(1)),
              participation: Number(participation.toFixed(1))
            },
            rationale: buildRationale({
              momentum,
              volatility,
              sentiment,
              participation
            })
          } satisfies StockSuggestion;
        } catch {
          return null;
        }
      })
    );

    const validCandidates = candidates.filter((item): item is NonNullable<typeof item> => item !== null);

    const [yahoo, alpha] = await Promise.all([getYahooSuggestions(), getAlphaVantageSuggestions()]);
    const ranked = rankAndLimit(mergeUniqueSuggestions(validCandidates, yahoo ?? [], alpha ?? [], fallbackSuggestions));

    if (ranked.length > 0) {
      return ranked;
    }

    if (config.STRICT_LIVE_MODE) {
      throwLiveDataUnavailable("Live best shares unavailable", "Live providers are unavailable");
    }

    return fallbackSuggestions;
  } catch {
    const [yahoo, alpha] = await Promise.all([getYahooSuggestions(), getAlphaVantageSuggestions()]);
    const merged = rankAndLimit(mergeUniqueSuggestions(yahoo ?? [], alpha ?? [], fallbackSuggestions));
    if (merged.length > 0) {
      return merged;
    }

    if (config.STRICT_LIVE_MODE) {
      throwLiveDataUnavailable("Live best shares unavailable", "Live providers are unavailable");
    }

    return fallbackSuggestions;
  }
}
