import { useCallback, useState } from "react";

/**
 * Pull-to-refresh helper: runs the given refetchers together and keeps the
 * spinner visible until all have settled.
 */
export function useRefresh(...refetchers: Array<() => Promise<unknown>>) {
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.allSettled(refetchers.map((fn) => fn()));
    } finally {
      setRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, refetchers);
  return { refreshing, onRefresh };
}
