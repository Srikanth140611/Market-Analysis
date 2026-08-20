import { useCallback, useEffect, useRef, useState } from "react";
import { getApiNotice } from "../api/client";

export function usePollingData<T>(fetcher: () => Promise<T>, intervalMs: number) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const inFlight = useRef(false);
  const fetcherRef = useRef(fetcher);

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
      setError(null);
      setNotice(getApiNotice());
      setLastUpdated(new Date());
    } catch (err) {
      const nextNotice = getApiNotice();
      if (nextNotice) {
        setError(null);
      } else {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
      setNotice(nextNotice);
    } finally {
      setLoading(false);
      inFlight.current = false;
    }
  }, []);

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

      const delay = Math.max(1_000, intervalMs + Math.round((Math.random() * 2 - 1) * jitterMs));

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

    void load();
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
  }, [intervalMs, load]);

  return {
    data,
    loading,
    error,
    notice,
    lastUpdated,
    reload: load
  };
}
