"use client";

import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";
import { computeAura, roundTenth, UP_THRESHOLD } from "@/lib/aura";
import type { BubbleSort, FeedSort, LeaderboardId } from "@/lib/validation";
import type {
  BubbleRankingEntry,
  BubbleSummary,
  CheckoutResult,
  CommentDto,
  CommentKind,
  GroupDto,
  Me,
  MessageDto,
  Page,
  ProfileCard,
  ProfileDetail,
  RankedProfile,
  ReportDto,
  SearchResults,
  VoteResult,
} from "@/types/api";

/* ── Query keys ────────────────────────────────────────────────────────── */
export const qk = {
  me: ["me"] as const,
  bubbles: ["bubbles"] as const,
  bubble: (slug: string) => ["bubble", slug] as const,
  feed: (slug: string, sort: FeedSort, q: string) => ["feed", slug, sort, q] as const,
  profile: (id: string) => ["profile", id] as const,
  comments: (id: string, kind: CommentKind) => ["comments", id, kind] as const,
  leaderboard: (scope: string, board: LeaderboardId, bubble?: string) =>
    ["leaderboard", scope, board, bubble ?? ""] as const,
  bubbleRankings: (sort: BubbleSort) => ["bubble-rankings", sort] as const,
  groups: (slug: string) => ["groups", slug] as const,
  messages: (groupId: string) => ["messages", groupId] as const,
  search: (q: string) => ["search", q] as const,
  reports: (status: string) => ["reports", status] as const,
};

/* ── Session ───────────────────────────────────────────────────────────── */
export function useMe() {
  return useQuery({
    queryKey: qk.me,
    queryFn: async () => (await apiFetch<{ me: Me | null }>("/api/me")).me,
    staleTime: 30_000,
  });
}

export function setBalance(qc: QueryClient, creditBalance: number) {
  qc.setQueryData<Me | null>(qk.me, (me) => (me ? { ...me, creditBalance } : me));
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { identifier: string; password: string }) =>
      apiFetch("/api/auth/login", { method: "POST", json: input }),
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useSignup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      email: string;
      handle: string;
      password: string;
      ageConfirmed: boolean;
      termsAccepted: boolean;
    }) => apiFetch("/api/auth/signup", { method: "POST", json: input }),
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch("/api/auth/logout", { method: "POST", json: {} }),
    onSuccess: () => {
      qc.setQueryData(qk.me, null);
      qc.invalidateQueries();
    },
  });
}

export function useAcceptTerms() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch("/api/me/terms", { method: "POST", json: { accepted: true } }),
    onSuccess: () => qc.setQueryData<Me | null>(qk.me, (me) => (me ? { ...me, termsAccepted: true } : me)),
  });
}

/* ── Bubbles ───────────────────────────────────────────────────────────── */
export function useBubbles(initialData?: BubbleSummary[]) {
  return useQuery({
    queryKey: qk.bubbles,
    queryFn: async () => (await apiFetch<{ bubbles: BubbleSummary[] }>("/api/bubbles")).bubbles,
    initialData,
    staleTime: 20_000,
    refetchInterval: 60_000,
  });
}

export function useBubble(slug: string, initialData?: BubbleSummary) {
  return useQuery({
    queryKey: qk.bubble(slug),
    queryFn: async () => (await apiFetch<{ bubble: BubbleSummary }>(`/api/bubbles/${slug}`)).bubble,
    initialData,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

export function useCreateBubble() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      name: string;
      description: string;
      kind: "CAMPUS" | "TOWN";
      badge?: string;
      logoUrl?: string;
      lat: number;
      lng: number;
    }) => apiFetch<{ bubble: BubbleSummary }>("/api/bubbles", { method: "POST", json: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.bubbles });
      qc.invalidateQueries({ queryKey: qk.me });
    },
  });
}

export function useMembership(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (join: boolean) =>
      apiFetch(`/api/bubbles/${slug}/membership`, { method: join ? "POST" : "DELETE", json: join ? {} : undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.me });
      qc.invalidateQueries({ queryKey: qk.bubble(slug) });
      qc.invalidateQueries({ queryKey: qk.bubbles });
    },
  });
}

export function useBubbleRankings(sort: BubbleSort, enabled = true) {
  return useQuery({
    queryKey: qk.bubbleRankings(sort),
    queryFn: async () => (await apiFetch<{ items: BubbleRankingEntry[] }>(`/api/bubbles/rankings?sort=${sort}`)).items,
    enabled,
    staleTime: 20_000,
    placeholderData: keepPreviousData,
  });
}

/* ── Feed & leaderboards ───────────────────────────────────────────────── */
export function useFeed(slug: string, sort: FeedSort, q: string, initial?: Page<ProfileCard>) {
  return useInfiniteQuery({
    queryKey: qk.feed(slug, sort, q),
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ sort, cursor: String(pageParam), limit: "24" });
      if (q) params.set("q", q);
      return apiFetch<Page<ProfileCard>>(`/api/bubbles/${slug}/profiles?${params}`);
    },
    initialPageParam: 0,
    getNextPageParam: (last) => (typeof last.nextCursor === "number" ? last.nextCursor : undefined),
    initialData: initial ? { pages: [initial], pageParams: [0] } : undefined,
    staleTime: 10_000,
    refetchInterval: 30_000,
    placeholderData: keepPreviousData,
  });
}

export function useLeaderboard(scope: "national" | "bubble", board: LeaderboardId, bubble?: string, enabled = true) {
  return useQuery({
    queryKey: qk.leaderboard(scope, board, bubble),
    queryFn: async () => {
      const params = new URLSearchParams({ scope, board });
      if (bubble) params.set("bubble", bubble);
      return (await apiFetch<{ items: RankedProfile[] }>(`/api/leaderboards?${params}`)).items;
    },
    enabled,
    staleTime: 15_000,
    refetchInterval: 30_000,
    placeholderData: keepPreviousData,
  });
}

export function useSearch(q: string) {
  return useQuery({
    queryKey: qk.search(q),
    queryFn: () => apiFetch<SearchResults>(`/api/search?q=${encodeURIComponent(q)}`),
    enabled: q.trim().length >= 2,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}

/* ── Profiles ──────────────────────────────────────────────────────────── */
export function useProfile(id: string, initialData?: ProfileDetail) {
  return useQuery({
    queryKey: qk.profile(id),
    queryFn: async () => (await apiFetch<{ profile: ProfileDetail }>(`/api/profiles/${id}`)).profile,
    initialData,
    staleTime: 5_000,
    refetchInterval: 15_000, // live score updates
  });
}

export type ProfileInput = {
  bubbleId: string;
  displayName: string;
  gender: "MALE" | "FEMALE" | "NON_BINARY";
  affiliation?: string;
  bio: string;
  photoUrl: string;
};

export function useCreateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ProfileInput & { consent: true }) =>
      apiFetch<{ profile: { id: string; bubbleSlug: string } }>("/api/profiles", { method: "POST", json: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.me });
      qc.invalidateQueries({ queryKey: ["feed"] });
      qc.invalidateQueries({ queryKey: qk.bubbles });
    },
  });
}

export function useUpdateProfile(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<Omit<ProfileInput, "affiliation">> & { affiliation?: string | null }) =>
      apiFetch<{ profile: ProfileDetail }>(`/api/profiles/${id}`, { method: "PATCH", json: input }),
    onSuccess: ({ profile }) => {
      qc.setQueryData(qk.profile(id), profile);
      qc.invalidateQueries({ queryKey: qk.me });
      qc.invalidateQueries({ queryKey: ["feed"] });
    },
  });
}

export function useDeleteProfile(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch(`/api/profiles/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.removeQueries({ queryKey: qk.profile(id) });
      qc.invalidateQueries();
    },
  });
}

/** Optimistically apply a rating change to a cached profile; the server response then reconciles exact numbers. */
function optimisticRate(p: ProfileDetail, value: number): ProfileDetail {
  const prev = p.myRating;
  const weight = prev?.weight ?? 1;
  const sum = (p.auraScore ?? 0) * p.voteCount - (prev ? prev.value * weight : 0) + value * weight;
  const votes = p.voteCount + (prev ? 0 : 1);
  const wasUp = prev ? prev.value >= UP_THRESHOLD : null;
  const isUp = value >= UP_THRESHOLD;
  let up = p.upCount;
  let down = p.downCount;
  if (wasUp === true) up -= weight;
  if (wasUp === false) down -= weight;
  if (isUp) up += weight;
  else down += weight;
  return {
    ...p,
    auraScore: computeAura(sum, votes),
    voteCount: votes,
    upCount: Math.max(0, up),
    downCount: Math.max(0, down),
    raterCount: p.raterCount + (prev ? 0 : 1),
    myRating: { value, weight, boostsToday: prev?.boostsToday ?? 0 },
  };
}

function applyVoteResult(qc: QueryClient, id: string, res: VoteResult) {
  qc.setQueryData<ProfileDetail>(qk.profile(id), (p) =>
    p
      ? {
          ...p,
          ...res.profile,
          auraScore: res.profile.auraScore === null ? null : roundTenth(res.profile.auraScore),
          myRating: res.myRating,
        }
      : p,
  );
  setBalance(qc, res.creditBalance);
  qc.invalidateQueries({ queryKey: ["feed"] });
  qc.invalidateQueries({ queryKey: ["leaderboard"] });
}

export function useRate(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (value: number) =>
      apiFetch<VoteResult>(`/api/profiles/${id}/rating`, { method: "PUT", json: { value } }),
    onMutate: async (value) => {
      await qc.cancelQueries({ queryKey: qk.profile(id) });
      const prev = qc.getQueryData<ProfileDetail>(qk.profile(id));
      if (prev) qc.setQueryData(qk.profile(id), optimisticRate(prev, value));
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(qk.profile(id), ctx.prev),
    onSuccess: (res) => applyVoteResult(qc, id, res),
  });
}

export function useBoost(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (clicks: number) =>
      apiFetch<VoteResult>(`/api/profiles/${id}/boost`, { method: "POST", json: { clicks } }),
    onSuccess: (res) => applyVoteResult(qc, id, res),
    onError: () => qc.invalidateQueries({ queryKey: qk.me }),
  });
}

/* ── Comments ──────────────────────────────────────────────────────────── */
export function useComments(id: string, kind: CommentKind) {
  return useInfiniteQuery({
    queryKey: qk.comments(id, kind),
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ kind });
      if (pageParam) params.set("before", pageParam);
      return apiFetch<Page<CommentDto>>(`/api/profiles/${id}/comments?${params}`);
    },
    initialPageParam: "" as string,
    getNextPageParam: (last) => (typeof last.nextCursor === "string" ? last.nextCursor : undefined),
    staleTime: 10_000,
    refetchInterval: 20_000,
  });
}

type CommentPages = { pages: Page<CommentDto>[]; pageParams: string[] };

export function useAddComment(id: string, kind: CommentKind) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) =>
      apiFetch<{ comment: CommentDto }>(`/api/profiles/${id}/comments`, { method: "POST", json: { kind, body } }),
    onSuccess: ({ comment }) => {
      qc.setQueryData<CommentPages>(qk.comments(id, kind), (data) =>
        data
          ? { ...data, pages: data.pages.map((p, i) => (i === 0 ? { ...p, items: [comment, ...p.items] } : p)) }
          : data,
      );
      qc.setQueryData<ProfileDetail>(qk.profile(id), (p) =>
        p
          ? {
              ...p,
              commentCount: p.commentCount + 1,
              ...(kind === "ADVICE" ? { adviceCount: p.adviceCount + 1 } : { generalCount: p.generalCount + 1 }),
            }
          : p,
      );
    },
  });
}

export function useDeleteComment(profileId: string, kind: CommentKind) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) => apiFetch(`/api/comments/${commentId}`, { method: "DELETE" }),
    onMutate: async (commentId) => {
      const key = qk.comments(profileId, kind);
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<CommentPages>(key);
      qc.setQueryData<CommentPages>(key, (data) =>
        data
          ? { ...data, pages: data.pages.map((p) => ({ ...p, items: p.items.filter((c) => c.id !== commentId) })) }
          : data,
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(qk.comments(profileId, kind), ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.profile(profileId) }),
  });
}

/* ── Groups ────────────────────────────────────────────────────────────── */
export function useGroups(slug: string, enabled = true) {
  return useQuery({
    queryKey: qk.groups(slug),
    queryFn: async () => (await apiFetch<{ groups: GroupDto[] }>(`/api/bubbles/${slug}/groups`)).groups,
    enabled,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

export function useCreateGroup(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; description: string }) =>
      apiFetch<{ group: GroupDto }>(`/api/bubbles/${slug}/groups`, { method: "POST", json: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.groups(slug) }),
  });
}

/** Live group chat: initial load, then poll for messages newer than the last one we have. */
export function useMessages(groupId: string | null) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: qk.messages(groupId ?? "none"),
    enabled: Boolean(groupId),
    queryFn: async () => {
      const key = qk.messages(groupId!);
      const existing = qc.getQueryData<MessageDto[]>(key);
      const last = existing?.[existing.length - 1];
      if (!existing || !last) {
        return (await apiFetch<{ items: MessageDto[] }>(`/api/groups/${groupId}/messages`)).items;
      }
      const res = await apiFetch<{ items: MessageDto[] }>(
        `/api/groups/${groupId}/messages?after=${encodeURIComponent(last.createdAt)}`,
      );
      if (res.items.length === 0) return existing;
      const seen = new Set(existing.map((m) => m.id));
      return [...existing, ...res.items.filter((m) => !seen.has(m.id))];
    },
    refetchInterval: 4_000,
    staleTime: 0,
  });
}

export function usePostMessage(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) =>
      apiFetch<{ message: MessageDto }>(`/api/groups/${groupId}/messages`, { method: "POST", json: { body } }),
    onSuccess: ({ message }) => {
      qc.setQueryData<MessageDto[]>(qk.messages(groupId), (list) =>
        list ? (list.some((m) => m.id === message.id) ? list : [...list, message]) : [message],
      );
    },
  });
}

export function useDeleteMessage(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/messages/${id}`, { method: "DELETE" }),
    onSuccess: (_d, id) =>
      qc.setQueryData<MessageDto[]>(qk.messages(groupId), (list) => list?.filter((m) => m.id !== id)),
  });
}

/* ── Trust & safety, credits, uploads ──────────────────────────────────── */
export function useReport() {
  return useMutation({
    mutationFn: (input: {
      targetType: "PROFILE" | "COMMENT" | "MESSAGE" | "BUBBLE";
      targetId: string;
      reason: string;
      details: string;
    }) => apiFetch("/api/reports", { method: "POST", json: input }),
  });
}

export function useReports(status: string) {
  return useQuery({
    queryKey: qk.reports(status),
    queryFn: async () => (await apiFetch<{ items: ReportDto[] }>(`/api/admin/reports?status=${status}`)).items,
  });
}

export function useResolveReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) =>
      apiFetch(`/api/admin/reports/${id}`, { method: "PATCH", json: { action } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reports"] }),
  });
}

export function useCheckout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (packId: string) =>
      apiFetch<CheckoutResult>("/api/credits/checkout", { method: "POST", json: { packId } }),
    onSuccess: (res) => {
      if (res.mode === "stripe" && res.url) window.location.assign(res.url);
      else if (typeof res.creditBalance === "number") setBalance(qc, res.creditBalance);
    },
  });
}

export function useUpload() {
  return useMutation({
    mutationFn: (file: Blob) => {
      const form = new FormData();
      form.append("file", file, "photo.jpg");
      return apiFetch<{ id: string; url: string }>("/api/uploads", { method: "POST", form });
    },
  });
}
