"use client";

import { useCallback, useEffect, useState } from "react";

/** Returns `guard(reason)` → true when the viewer may act; otherwise opens the sign-in prompt. */
export function useAuthGuard() {
  return useCallback((reason: string) => {
    // Rating and commenting never need sign-up: the server gives this device an anonymous identity.
    void reason;
    return true;
  }, []);
}

export function useDebounced<T>(value: T, ms = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}
