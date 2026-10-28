import { useCallback, useEffect, useState } from "react";

export function useApiData<T>(
  loader: () => Promise<T>,
  dependencies: readonly unknown[] = [],
  initialData: T | null = null,
) {
  const [data, setData] = useState<T | null>(initialData);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(initialData === null);
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setData(await loader());
      setError(null);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to load this content.",
      );
    } finally {
      setLoading(false);
    }
  }, dependencies);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return { data, error, loading, refresh, setData };
}
