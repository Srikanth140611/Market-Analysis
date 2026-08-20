import { useCallback, useEffect, useRef, useState } from "react";
import { getApiNotice } from "../api/client";

type PollingCacheEntry = {
  data: unknown;
  updatedAt: number;
};

const pollingCache = new Map<string, PollingCacheEntry>();

type PollingOptions = {
  keepPreviousDataOnError?: boolean;
};

export function usePollingData<T>(fetcher: () => Promise<T>, intervalMs: number, cacheKey?: string, options?: PollingOptions) {
  const keepPreviousDataOnError = options?.keepPreviousDataOnError ?? true;
  const cached = cacheKey ? pollingCache.get(cacheKey) : undefined;
  const [data, setData] = useState<T | null>(() => (cached ? (cached.data as T) : null));
  const [loading, setLoading] = useState(() => !cached);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(() =>
    cached ? "Showing cached data while live refresh reconnects." : null
  );
  const [lastUpdated, setLastUpdated] = useState<Date | null>(() =>
    cached ? new Date(cached.updatedAt) : null
  );
  const inFlight = useRef(false);
  const fetcherRef = useRef(fetcher);
  const failureCountRef = useRef(0);

  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  const load = useCallback(async () => {
    if (inFlight.current) {
      return;
    }

    inFlight.current = true;

    try {
      const result = await fetcherRef.current();
      setData(result);
      if (cacheKey) {
        pollingCache.set(cacheKey, { data: result, updatedAt: Date.now() });
      }
      setError(null);
      setNotice(getApiNotice());
      setLastUpdated(new Date());
      failureCountRef.current = 0;
    } catch (err) {
      const nextNotice = getApiNotice();
      failureCountRef.current += 1;

      if (nextNotice) {
        setError(null);
        setNotice(nextNotice);
      } else if (data && keepPreviousDataOnError) {
        // Keep last known good data and avoid noisy transient failures.
        setError(null);
        setNotice("Live refresh is delayed. Showing last successful data.");
      } else {
        if (!keepPreviousDataOnError) {
          setData(null);
        }
        setError(err instanceof Error ? err.message : "Something went wrong");
        setNotice(null);
      }
    } finally {
      setLoading(false);
      inFlight.current = false;
    }
  }, [cacheKey, data, keepPreviousDataOnError]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    const jitterMs = Math.min(5_000, Math.max(800, Math.round(intervalMs * 0.2)));

    const isPageVisible = () => {
      if (typeof document === "undefined") {
        return true;
      }

      return document.visibilityState === "visible";
    };

    const schedule = () => {
      if (stopped) {
        return;
      }

      const failureBackoffMultiplier = Math.min(4, Math.max(1, failureCountRef.current));
      const baseDelay = intervalMs * failureBackoffMultiplier;
      const delay = Math.max(1_000, baseDelay + Math.round((Math.random() * 2 - 1) * jitterMs));

      timer = setTimeout(() => {
        if (!isPageVisible()) {
          schedule();
          return;
        }

        void load().finally(schedule);
      }, delay);
    };

    const refreshWhenVisible = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        return;
      }

      void load();
    };

    if (!data) {
      void load();
    }
    schedule();

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", refreshWhenVisible);
    }

    if (typeof window !== "undefined") {
      window.addEventListener("focus", refreshWhenVisible);
    }

    return () => {
      stopped = true;
      if (timer) {
        clearTimeout(timer);
      }

      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", refreshWhenVisible);
      }

      if (typeof window !== "undefined") {
        window.removeEventListener("focus", refreshWhenVisible);
      }
    };
  }, [data, intervalMs, load]);

  return {
    data,
    loading,
    error,
    notice,
    lastUpdated,
    reload: load
  };
}
