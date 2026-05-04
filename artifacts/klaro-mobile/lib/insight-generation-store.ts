/**
 * Module-level observable store for insight generation state.
 * Survives component unmounts and re-renders all subscribers when state changes.
 */

import { useEffect, useState } from "react";

let _startedAt: number | null = null;
const _listeners = new Set<() => void>();

function notify() {
  _listeners.forEach((fn) => fn());
}

export function insightGenStart() {
  _startedAt = Date.now();
  notify();
}

export function insightGenEnd() {
  _startedAt = null;
  notify();
}

export function getInsightGenStartedAt() {
  return _startedAt;
}

export function useInsightGenStartedAt(): number | null {
  const [val, setVal] = useState<number | null>(() => _startedAt);
  useEffect(() => {
    const sync = () => setVal(_startedAt);
    _listeners.add(sync);
    return () => { _listeners.delete(sync); };
  }, []);
  return val;
}
