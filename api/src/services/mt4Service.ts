export type Mt4Position = {
  symbol: string;
  side: "BUY" | "SELL";
  volume: number;
  openPrice: number;
  profit: number;
  stopLoss?: number;
  takeProfit?: number;
};

export type Mt4PendingOrder = {
  symbol: string;
  type: "BUY_LIMIT" | "BUY_STOP" | "SELL_LIMIT" | "SELL_STOP";
  price: number;
  volume: number;
  stopLoss?: number;
  takeProfit?: number;
};

export type Mt4Quote = {
  symbol: string;
  bid: number;
  ask: number;
  spread?: number;
  timestamp: string;
};

export type Mt4Snapshot = {
  accountId: string;
  terminalId: string;
  server?: string;
  timestamp: string;
  heartbeat?: number;
  balance?: number;
  equity?: number;
  margin?: number;
  freeMargin?: number;
  positions?: Mt4Position[];
  pendingOrders?: Mt4PendingOrder[];
  quotes?: Mt4Quote[];
};

export type Mt4SnapshotResponse = Mt4Snapshot & {
  source: "mt4";
  receivedAt: string;
  ageSeconds: number;
  healthStatus: "fresh" | "stale" | "offline";
  healthNote: string;
};

function describeSnapshotHealth(ageSeconds: number) {
  if (ageSeconds <= 30) {
    return {
      healthStatus: "fresh" as const,
      healthNote: "Snapshot is live (<= 30s old)"
    };
  }

  if (ageSeconds <= 180) {
    return {
      healthStatus: "stale" as const,
      healthNote: "Snapshot is delayed (> 30s old)"
    };
  }

  return {
    healthStatus: "offline" as const,
    healthNote: "Snapshot feed appears offline (> 3m old)"
  };
}

let latestSnapshot: Mt4SnapshotResponse | null = null;

export function storeMt4Snapshot(snapshot: Mt4Snapshot): Mt4SnapshotResponse {
  const receivedAt = new Date().toISOString();
  const parsedTimestamp = Date.parse(snapshot.timestamp);
  const timestamp = Number.isFinite(parsedTimestamp) ? snapshot.timestamp : receivedAt;
  const ageSeconds = Math.max(0, Math.round((Date.now() - Date.parse(timestamp)) / 1000));
  const health = describeSnapshotHealth(ageSeconds);

  latestSnapshot = {
    ...snapshot,
    timestamp,
    source: "mt4",
    receivedAt,
    ageSeconds,
    ...health
  };

  return latestSnapshot;
}

export function getLatestMt4Snapshot(): Mt4SnapshotResponse | null {
  if (!latestSnapshot) {
    return null;
  }

  const ageSeconds = Math.max(0, Math.round((Date.now() - Date.parse(latestSnapshot.timestamp)) / 1000));
  const health = describeSnapshotHealth(ageSeconds);
  return {
    ...latestSnapshot,
    ageSeconds,
    ...health
  };
}