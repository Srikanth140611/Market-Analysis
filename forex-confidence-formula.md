# Forex Confidence Formula

This note explains how the app derives the forex `confidence%` and the separate calibrated confidence overlay.

## 1. Raw confidence

Forex does **not** use a learned model. The displayed raw confidence comes from the historical pattern classifier in the backend.

The classifier looks at:

- moving average alignment
- slope of recent closes
- RSI extremes
- support/resistance proximity
- Bollinger compression / range tightness
- ATR-based volatility regime
- implied-volatility proxy from Bollinger width + ATR

### Pattern-based raw confidence values

The classifier first chooses a pattern type and assigns a base confidence:

- `compression` -> about `63`
- `breakout` -> about `74`
- `reversal` -> about `71`
- `range` -> about `66`
- `trend` -> `68 + abs(slope) * 1.5`, capped to `60-88`
- `momentum` -> `60 + abs(slope) * 1.2`, capped to `55-82`

### Pattern selection logic

- `compression`: tight candles, low Bollinger width, small average range
- `breakout`: price pressing near support/resistance with directional slope
- `reversal`: RSI stretched and slope starts turning back
- `trend`: price stays above or below the moving averages with slope agreement
- `range`: price is boxed in with limited expansion
- `momentum`: fallback when no stronger structure applies

## 2. Forex-specific use of raw confidence

The raw confidence is then adjusted with a volatility regime check before being used in the agent layer for:

- ranking signals
- building trade plans
- deciding best signal across timeframes

The volatility and historical recurrence filters are small and bounded so they support pattern confidence without overpowering the structural read.

```text
volatilityAdjustment =
  +4 when Bollinger width is very compressed
  +2 when ATR is unusually low
  -2 when ATR is elevated
  -3 when implied volatility proxy is elevated
  clamped to [-6, +6]
```

So the live confidence used by agents is:

```text
finalConfidence = clamp(patternConfidence + historicalRecurrenceScore + sentimentFlowImpact + volatilityAdjustment + oscillatorAdjustment, 45, 94)
```

Historical recurrence is added in the agent layer as a bounded adjustment:

```text
finalConfidence = clamp(patternConfidence + historicalRecurrenceScore + sentimentFlowImpact + volatilityAdjustment + oscillatorAdjustment, 45, 94)
historicalRecurrenceScore = clamp(round((alignedFollowThrough / comparableCases - 0.5) * 10), -6, +6)
```

The recurrence score is only calculated when at least three comparable prior setups are found near the current support/resistance zone. Matching prior direction increases confidence; opposite follow-through decreases it.

It is **not** replaced by a separate forex-only formula.

## 3. Best-signal ranking

When the app chooses the strongest forex signal, it uses:

```text
score = confidence + timeframeWeight + confluenceScore / 10
```

Where:

- `confidence` = raw pattern confidence
- `timeframeWeight` = `1hour: 5`, `4hour: 4`, `12hour: 3`, `1Day: 2`, `1Week: 1`
- `confluenceScore` comes from pattern + fundamentals

## 4. Confluence score

The confluence score is a blended quality score:

```text
confluenceScore = round((pattern.confidence * 0.6) + (fundamentals.macroScore * 0.4))
```

This is used to describe setup quality, not to replace the raw pattern confidence.

## 5. Calibrated confidence overlay

The app also produces a calibrated confidence based on historical simulated trade outcomes.

### Buckets

Raw confidence is grouped into buckets:

- `55-64`
- `65-74`
- `75-84`
- `85+`

### Bayesian smoothing

For each timeframe and bucket:

```text
prior = clamp(rawConfidence / 100, 0.01, 0.99)
posterior = (wins + 25 * prior) / (total + 25)
calibratedConfidence = round(clamp(posterior * 100, 1, 99))
```

Where:

- `wins` = number of historical take-profit hits
- `total` = number of historical resolved trades
- `25` = prior smoothing weight

## 6. Summary

For forex, the confidence displayed in the app is:

1. a heuristic pattern confidence from price action
2. optionally paired with a calibrated confidence from historical outcomes
3. combined with confluence and timeframe weight for signal ranking

So the core answer is:

- **Raw confidence** = pattern score from technical structure
- **Calibrated confidence** = smoothed historical win-rate overlay
- **Best-signal ranking** = raw confidence + timeframe weight + confluence
