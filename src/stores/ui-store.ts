"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type RankingsTab = "profiles" | "bubbles";

type MapView = { center: [number, number]; zoom: number };

interface UiState {
  rankingsOpen: boolean;
  rankingsTab: RankingsTab;
  openRankings: (tab?: RankingsTab) => void;
  closeRankings: () => void;

  profileFormOpen: boolean;
  profileFormBubbleId: string | null;
  openProfileForm: (bubbleId?: string | null) => void;
  closeProfileForm: () => void;

  creditsOpen: boolean;
  setCreditsOpen: (open: boolean) => void;

  authPrompt: string | null;
  promptAuth: (reason: string) => void;
  closeAuthPrompt: () => void;

  mapView: MapView | null;
  setMapView: (v: MapView) => void;
}

/** Client UI state — modals, prompts and the last map viewport (persisted per tab session). */
export const useUi = create<UiState>()(
  persist(
    (set) => ({
      rankingsOpen: false,
      rankingsTab: "profiles",
      openRankings: (tab) => set((s) => ({ rankingsOpen: true, rankingsTab: tab ?? s.rankingsTab })),
      closeRankings: () => set({ rankingsOpen: false }),

      profileFormOpen: false,
      profileFormBubbleId: null,
      openProfileForm: (bubbleId = null) => set({ profileFormOpen: true, profileFormBubbleId: bubbleId }),
      closeProfileForm: () => set({ profileFormOpen: false }),

      creditsOpen: false,
      setCreditsOpen: (creditsOpen) => set({ creditsOpen }),

      authPrompt: null,
      promptAuth: (authPrompt) => set({ authPrompt }),
      closeAuthPrompt: () => set({ authPrompt: null }),

      mapView: null,
      setMapView: (mapView) => set({ mapView }),
    }),
    {
      name: "pc-ui",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (s) => ({ mapView: s.mapView, rankingsTab: s.rankingsTab }),
    },
  ),
);
