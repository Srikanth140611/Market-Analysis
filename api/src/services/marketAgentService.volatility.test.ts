import assert from "node:assert/strict";
import {
  buildTechnicalAnalysis,
  computeHistoricalRecurrenceConfidenceAdjustment,
  computeVolatilityConfidenceAdjustment
} from "./marketAgentService.js";
import { detectCandlestickPattern } from "./marketHistoryService.js";

const candles = Array.from({ length: 25 }, (_, index) => {
  const base = 1.095 + index * 0.0004;
  return {
    t: index * 3600,
    o: base,
    h: base + 0.0008,
    l: base - 0.0006,
    c: base + 0.0002
  };
});

const technicals = buildTechnicalAnalysis("EUR/USD", "1hour", candles, 1.09, 1.11);

assert.ok(Number.isFinite(technicals.atrPercent));
assert.ok(Number.isFinite(technicals.impliedVolatilityPercent));
assert.ok(computeVolatilityConfidenceAdjustment(technicals) !== 0);
assert.equal(computeHistoricalRecurrenceConfidenceAdjustment(4), 4);
assert.equal(computeHistoricalRecurrenceConfidenceAdjustment(-20), -6);
assert.equal(computeHistoricalRecurrenceConfidenceAdjustment(undefined), 0);

const validThreeBlackCrows = [
  { t: 0, o: 1.090, h: 1.112, l: 1.088, c: 1.110 },
  { t: 1, o: 1.110, h: 1.111, l: 1.095, c: 1.098 },
  { t: 2, o: 1.099, h: 1.100, l: 1.083, c: 1.086 },
  { t: 3, o: 1.087, h: 1.088, l: 1.071, c: 1.074 }
];
const ordinaryDecline = [
  { t: 0, o: 1.110, h: 1.116, l: 1.095, c: 1.098 },
  { t: 1, o: 1.105, h: 1.112, l: 1.083, c: 1.086 },
  { t: 2, o: 1.100, h: 1.108, l: 1.071, c: 1.074 },
  { t: 3, o: 1.090, h: 1.098, l: 1.068, c: 1.070 }
];
assert.equal(detectCandlestickPattern(validThreeBlackCrows, -1).pattern, "three-black-crows");
assert.notEqual(detectCandlestickPattern(ordinaryDecline, -1).pattern, "three-black-crows");

const bullishEngulfing = [
  { t: 0, o: 1.110, h: 1.112, l: 1.096, c: 1.100 },
  { t: 1, o: 1.098, h: 1.116, l: 1.096, c: 1.114 }
];
assert.equal(
  detectCandlestickPattern(bullishEngulfing, -1, { isAtSupport: true, isAtResistance: false }).pattern,
  "bullish-engulfing"
);
assert.equal(
  detectCandlestickPattern(bullishEngulfing, -1, { isAtSupport: false, isAtResistance: false }).pattern,
  "none"
);

console.log("volatility-adjustment-ok", {
  atrPercent: technicals.atrPercent,
  impliedVolatilityPercent: technicals.impliedVolatilityPercent,
  adjustment: computeVolatilityConfidenceAdjustment(technicals)
});
