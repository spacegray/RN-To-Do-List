import { useEffect, useState } from 'react';

/** The current time, refreshed every `ms`, so "overdue" and "today" stay accurate while the app is open. */
export function useNow(ms = 30000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}
