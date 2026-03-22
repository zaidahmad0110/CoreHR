import { useCallback, useEffect, useRef, useState } from "react";

export function useApiQuery<T>(
  fetcher: () => Promise<T>,
  dependencies: unknown[],
  options?: { skip?: boolean },
) {
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!options?.skip);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async () => {
    if (options?.skip) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await fetcherRef.current();
      setData(result);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Something went wrong.");
      }
    } finally {
      setLoading(false);
    }
  }, [options?.skip]);

  useEffect(() => {
    void execute();
  }, [execute, ...dependencies]);

  return {
    data,
    loading,
    error,
    refetch: execute,
    setData,
  };
}
