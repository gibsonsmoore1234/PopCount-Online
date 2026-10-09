"use client";

import { useCallback, useEffect, useState } from "react";
import { useMe } from "./api";
import { useUi } from "@/stores/ui-store";

/** Returns `guard(reason)` → true when the viewer may act; otherwise opens the sign-in prompt. */
export function useAuthGuard() {
  const { data: me } = useMe();
  const promptAuth = useUi((s) => s.promptAuth);
  return useCallback(
    (reason: string) => {
      if (me) return true;
      promptAuth(reason);
      return false;
    },
    [me, promptAuth],
  );
}

export function useDebounced<T>(value: T, ms = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}
