# Candlestick Pattern Reference

This document describes the pattern vocabulary currently supported by the market-history detector.

## Count

The detector supports **37 named patterns**, plus `none` when no qualifying pattern is found.

The patterns are evaluated independently for each symbol and timeframe using that symbol's latest OHLC candles. A pattern on one forex pair must not be copied to another pair.

## Important Interpretation Rules

- A pattern is a local price formation, not a market-wide condition.
- The latest candle should normally be completed before it is classified.
- Multi-candle patterns must use consecutive candles from the same symbol and timeframe.
- Context matters. Reversal patterns need a preceding trend; continuation patterns need an existing directional move; indecision patterns need confirmation.
- A detected pattern is evidence, not a trade instruction. It should be combined with support/resistance, trend, volume, volatility, and risk controls.
- `none` is the correct result when the candle structure is not strong enough.
- The Agents confidence model treats a valid candlestick pattern as mandatory. If the result is `none`, that pair/timeframe is omitted from confidence-bearing signal cards instead of receiving a technical confidence percentage.

## Single-Candle Patterns

| Pattern | Bias | Understanding and appropriate use |
|---|---|---|
| Doji | Neutral | Open and close are nearly equal. It shows indecision, not an automatic reversal. Use it as a pause or warning that needs the next candle and nearby support/resistance for direction. |
| Dragonfly Doji | Bullish | A small body near the high with a long lower wick. Sellers pushed price down but buyers recovered it. Most useful at support after a decline, with bullish confirmation. |
| Gravestone Doji | Bearish | A small body near the low with a long upper wick. Buyers pushed price up but sellers rejected the move. Most useful at resistance after an advance, with bearish confirmation. |
| Hammer | Bullish | A small body with a long lower wick after a decline. It shows rejection of lower prices. Use near support after a down move, not in the middle of a range without confirmation. |
| Inverted Hammer | Potentially bullish | A small body with a long upper wick after a decline. It shows attempted buying but needs a bullish following candle before being trusted. |
| Hanging Man | Bearish warning | Hammer-shaped candle after an advance. The lower-wick rejection occurred during an uptrend, so it can warn of distribution. It needs bearish confirmation. |
| Bullish Spinning Top | Weak bullish / indecision | A small bullish body with meaningful upper and lower wicks. Buyers have a slight edge, but neither side controls price. Use as context, not as a standalone signal. |
| Bearish Spinning Top | Weak bearish / indecision | A small bearish body with meaningful upper and lower wicks. Sellers have a slight edge, but conviction is low. Require follow-through. |
| Bullish Marubozu | Bullish | A large bullish body with very small shadows. It indicates strong buyer control. It is more useful on a breakout or confirmed trend than after an already extended move. |

## Two-Candle Patterns

| Pattern | Bias | Understanding and appropriate use |
|---|---|---|
| Bullish Kicker | Strong bullish | A bearish marubozu is followed by a bullish marubozu with a sharp gap or displacement. It represents an abrupt sentiment reversal. It is rare in spot forex because true gaps are uncommon, so synthetic or continuous data should be treated carefully. |
| Bearish Kicker | Strong bearish | The bearish counterpart: a bullish marubozu is followed by a bearish marubozu with sharp displacement. Use only when the gap/displacement and candle quality are genuine. |
| Bullish Engulfing | Bullish reversal | A bullish candle fully covers the prior bearish real body. Strongest after a decline and near support. Confirmation is still useful when the surrounding trend is strong. |
| Bearish Engulfing | Bearish reversal | A bearish candle fully covers the prior bullish real body. Strongest after an advance and near resistance. |
| Piercing Line | Bullish reversal | A bullish candle closes above the midpoint of the previous bearish body but remains below that candle's open. Use after a decline near support. |
| Dark Cloud Cover | Bearish reversal | A bearish candle closes below the midpoint of the previous bullish body but remains above that candle's open. Use after an advance near resistance. |
| Tweezer Bottom | Bullish reversal | Consecutive candles test approximately the same low, followed by a bullish response. The equal low is more meaningful near support and requires confirmation. |
| Tweezer Top | Bearish reversal | Consecutive candles test approximately the same high, followed by a bearish response. The equal high is more meaningful near resistance. |
| Bullish Harami | Bullish reversal warning | A small bullish candle forms inside the prior large bearish real body. It signals selling pressure is slowing, not that reversal is guaranteed. |
| Bearish Harami | Bearish reversal warning | A small bearish candle forms inside the prior large bullish real body. Use as a warning of weakening upside momentum. |
| Rising Window | Bullish continuation | The current low is above the previous high, creating an upward gap. In spot forex this is uncommon outside session opens or volatile events, so derived candles need special caution. |
| Falling Window | Bearish continuation | The current high is below the previous low, creating a downward gap. Validate that the gap is real and not caused by aggregation or missing data. |

## Three-Candle Patterns

| Pattern | Bias | Understanding and appropriate use |
|---|---|---|
| Morning Star | Bullish reversal | A bearish candle is followed by a small indecision candle and then a strong bullish candle that recovers meaningful ground. Use after a decline near support. |
| Three White Soldiers | Bullish continuation or reversal | Three consecutive substantial bullish candles with progressively higher closes. It is strongest after a decline or consolidation, but can become overextended if it appears after a long rally. |
| Three Black Crows | Bearish continuation or reversal | Three consecutive substantial bearish candles with progressively lower closes, controlled upper shadows, and opens within prior real bodies. It should normally follow a bullish advance or clear upward context. A prolonged downtrend alone is not enough. |
| Three Inside Up | Bullish reversal | A bearish candle, an inside bullish candle, and a third bullish candle that confirms upward recovery. Use after a decline. |
| Three Inside Down | Bearish reversal | A bullish candle, an inside bearish candle, and a third bearish candle that confirms downward recovery. Use after an advance. |
| Three Outside Up | Bullish reversal | A bullish engulfing formation followed by another bullish candle that confirms the reversal. Use near support after a decline. |
| Three Outside Down | Bearish reversal | A bearish engulfing formation followed by another bearish candle that confirms the reversal. Use near resistance after an advance. |
| Three-Line Strike | Direction depends on setup | Three candles move in one direction and the fourth candle strongly reverses through the prior sequence. It can represent exhaustion, but the fourth candle requires context and confirmation rather than automatic reversal treatment. |
| Bullish Abandoned Baby | Strong bullish reversal | A bearish candle, isolated doji, and bullish candle form with gaps separating the doji. The pattern is rare in continuous forex markets and should not be inferred from ordinary candle aggregation. |
| Bearish Abandoned Baby | Strong bearish reversal | The bearish counterpart: a bullish candle, isolated doji, and bearish candle with gaps. Validate the gaps before using it. |

## Multi-Candle Chart Structures

These are included in the detector's candlestick vocabulary but are better described as price structures than classical single-candle patterns.

| Pattern | Bias | Understanding and appropriate use |
|---|---|---|
| Cup and Handle | Bullish continuation | A rounded recovery forms the cup and a smaller pullback forms the handle. Use only after a confirmed breakout above the rim or resistance. |
| Double Top | Bearish reversal | Price tests a comparable high twice and fails to break through. The pattern needs a neckline break or clear rejection; two nearby highs alone are insufficient. |
| Double Bottom | Bullish reversal | Price tests a comparable low twice and holds. Confirmation normally comes from a neckline break or reclaim of resistance. |
| Doble Bottom | Bullish reversal | Project-specific misspelling of `double-bottom`; it represents the same intended bullish double-bottom structure. It should eventually be normalized to avoid duplicate labels. |
| Wedge | Usually breakout warning | Price contracts between converging boundaries. Direction is not guaranteed by the shape alone; use the eventual breakout and volume/close confirmation. |
| Flag | Continuation | A short consolidation after a directional impulse. The expected direction follows the prior impulse, but the breakout candle must confirm it. |

## Project-Specific Notes

- The detector currently has both `double-bottom` and the misspelled `doble-bottom`. They describe the same concept and should be merged or normalized.
- `bullish-abondened-baby` and `bearish-abondened-baby` are also project spellings of **abandoned baby**.
- `bullish-kikker` and `bearish-kikker` are project labels for a gap-driven abrupt reversal formation; they are not common standard labels in most candlestick references.
- `three-black-crows` must never be used as a generic label for any falling market. It must be computed from the individual pair/timeframe candles and must include prior bullish context.
- When OHLC data is fallback, derived, sparse, or aggregated, gap-based patterns and precise multi-candle patterns should be downgraded or reported as `none` unless the candle structure is reliable.
