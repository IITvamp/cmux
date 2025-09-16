import { useCallback, useEffect, useRef, useState } from "react";

import { fetchAllElectronLogs } from "@/lib/logs";
import type { ElectronLogFile } from "@/types/electron-logs";

interface UseElectronLogsOptions {
  enabled?: boolean;
}

interface UseElectronLogsValue {
  logs: ElectronLogFile[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refresh: () => Promise<void>;
}

export function useElectronLogs(
  options?: UseElectronLogsOptions
): UseElectronLogsValue {
  const enabled = options?.enabled ?? true;
  const [logs, setLogs] = useState<ElectronLogFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!enabled) {
      return;
    }

    if (mountedRef.current) {
      setLoading(true);
      setError(null);
    }

    try {
      const data = await fetchAllElectronLogs();
      if (!mountedRef.current) return;
      setLogs(data);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      if (!mountedRef.current) return;
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setLogs([]);
      setError(null);
      setLastUpdated(null);
      return;
    }
    void refresh();
  }, [enabled, refresh]);

  return { logs, loading, error, lastUpdated, refresh };
}
