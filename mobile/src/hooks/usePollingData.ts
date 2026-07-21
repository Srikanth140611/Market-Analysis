import { useCallback, useEffect, useRef, useState } from "react";

export function usePollingData<T>(fetcher: () => Promise<T>, intervalMs: number) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    if (inFlight.current) {
      return;
    }

    inFlight.current = true;

    try {
      const result = await fetcher();
      setData(result);
      setError(null);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
      inFlight.current = false;
    }
  }, [fetcher]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => {
      void load();
    }, intervalMs);

    return () => {
      clearInterval(timer);
    };
  }, [intervalMs, load]);

  return {
    data,
    loading,
    error,
    lastUpdated,
    reload: load
  };
}
