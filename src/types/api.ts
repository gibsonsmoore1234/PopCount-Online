/** Data-transfer types shared by API route handlers and the client. Dates are ISO strings. */

export type Gender = "MALE" | "FEMALE" | "NON_BINARY";
export type BubbleKind = "CAMPUS" | "TOWN";
export type CommentKind = "COMMENT" | "ADVICE";
export type Role = "USER" | "ADMIN";

export interface Me {
  id: string;
  email: string;
  handle: string;
  role: Role;
  isAnonymous: boolean;
  creditBalance: number;
  termsAccepted: boolean;
  profile: { id: string; displayName: string; photoUrl: string; bubbleSlug: string; bubbleName: string } | null;
  memberships: string[];
}

export interface BubbleSummary {
  id: string;
  slug: string;
  name: string;
  description: string;
  kind: BubbleKind;
  badge: string | null;
  logoUrl: string | null;
  lat: number;
  lng: number;
  countyFips: string;
  countyName: string;
  stateName: string;
  population: number | null;
  memberCount: number;
  profileCount: number;
  avgAura: number | null;
  totalVotes: number;
  isOfficial: boolean;
}

export interface BubbleRankingEntry extends BubbleSummary {
  rank: number;
  recentVotes: number;
}

export interface ProfileCard {
  id: string;
  displayName: string;
  handle: string;
  gender: Gender;
  affiliation: string | null;
  photoUrl: string;
  auraScore: number | null;
  voteCount: number;
  upCount: number;
  downCount: number;
  commentCount: number;
  bubble: { slug: string; name: string };
}

export interface RankedProfile extends ProfileCard {
  rank: number;
}

export type StickerTone = "high" | "mid" | "low" | "ink";
export interface Sticker {
  id: string;
  label: string;
  tone: StickerTone;
}

export interface MyRating {
  value: number;
  weight: number;
  boostsToday: number;
}

export interface ProfileDetail extends ProfileCard {
  userId: string;
  bio: string;
  /** Main photo first, then up to two more. */
  photos: string[];
  raterCount: number;
  adviceCount: number;
  generalCount: number;
  createdAt: string;
  isHidden: boolean;
  isOwner: boolean;
  nationalRank: number | null;
  nationalEligible: number;
  stickers: Sticker[];
  myRating: MyRating | null;
}

export interface VoteResult {
  profile: Pick<ProfileDetail, "id" | "auraScore" | "voteCount" | "upCount" | "downCount" | "raterCount">;
  myRating: MyRating;
  creditBalance: number;
}

export interface CommentDto {
  id: string;
  kind: CommentKind;
  body: string;
  createdAt: string;
  author: { handle: string; profileId: string | null; photoUrl: string | null };
  isMine: boolean;
  canDelete: boolean;
}

export interface GroupDto {
  id: string;
  slug: string;
  name: string;
  description: string;
  messageCount: number;
  lastMessageAt: string | null;
}

export interface MessageDto {
  id: string;
  body: string;
  createdAt: string;
  author: { handle: string; profileId: string | null; photoUrl: string | null };
  isMine: boolean;
}

export interface Page<T> {
  items: T[];
  nextCursor: number | string | null;
}

export interface SearchResults {
  profiles: RankedProfile[];
  bubbles: BubbleSummary[];
}

export interface ReportDto {
  id: string;
  targetType: "PROFILE" | "COMMENT" | "MESSAGE" | "BUBBLE";
  targetId: string;
  reason: string;
  details: string;
  status: "OPEN" | "ACTIONED" | "DISMISSED";
  createdAt: string;
  reporter: string;
  reportCount: number;
  target: { title: string; body: string; href: string | null; hidden: boolean; ownerHandle: string | null } | null;
}
