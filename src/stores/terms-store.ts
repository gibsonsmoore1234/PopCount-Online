"use client";

import { create } from "zustand";
import { TERMS_COOKIE, TERMS_VERSION } from "@/lib/terms";

interface TermsState {
  accepted: boolean;
  accept: () => void;
}

/**
 * Terms-gate state. Persisted to a first-party cookie (not just localStorage) so the server
 * can render the gate — or skip it — on the very first paint without a flash.
 */
export const useTerms = create<TermsState>()((set) => ({
  accepted: false,
  accept: () => {
    const secure = location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${TERMS_COOKIE}=${TERMS_VERSION}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
    set({ accepted: true });
  },
}));
