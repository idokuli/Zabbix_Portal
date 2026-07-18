import { useEffect } from "react";
import { useRefreshTick } from "../../app/context/RefreshContext";

/**
 * Wires up the two standard report-tab effects:
 *  1. Call load() on mount (and whenever load changes, i.e. when deps like `hours` change).
 *  2. Call load(true) silently on every refresh tick.
 *
 * The caller defines the memoised `load` callback and owns the data/loading state.
 */
export const useReportLoader = (load: (silent?: boolean) => void) => {
  const tick = useRefreshTick();

  useEffect(() => {
    load();
  }, [load]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: tick triggers silent auto-refresh
  useEffect(() => {
    if (tick > 0) {
      load(true);
    }
  }, [tick]);
};
