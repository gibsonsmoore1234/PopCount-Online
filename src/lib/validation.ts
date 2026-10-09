import { z } from "zod";

const trimmed = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .min(min, `${label} must be at least ${min} characters.`)
    .max(max, `${label} must be at most ${max} characters.`);

const optionalTrimmed = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be at most ${max} characters.`)
    .transform((v) => (v ? v : undefined))
    .optional();

export const handleSchema = z
  .string()
  .trim()
  .regex(/^[a-zA-Z0-9_]{3,20}$/, "Handles are 3–20 letters, numbers or underscores.");

export const emailSchema = z.string().trim().toLowerCase().max(254).pipe(z.email("Enter a valid email address."));

export const passwordSchema = z
  .string()
  .min(8, "Passwords must be at least 8 characters.")
  .max(128, "Passwords must be at most 128 characters.");

export const signupSchema = z.object({
  email: emailSchema,
  handle: handleSchema,
  password: passwordSchema,
  ageConfirmed: z.literal(true, { error: "You must be 18 or older to join." }),
  termsAccepted: z.literal(true, { error: "You must accept the Terms of Service." }),
});
export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  identifier: z.string().trim().min(3, "Enter your email or handle.").max(254),
  password: z.string().min(1, "Enter your password.").max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

const UUID_RE = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const LOCAL_IMAGE = new RegExp(`^/api/images/${UUID_RE}$`, "i");
const LOCAL_AVATAR = /^\/api\/avatar\/[a-zA-Z0-9_-]{1,64}$/;

/** Photos must be HTTPS URLs or images served by this app — never javascript:, data: or plain http. */
export const imageUrlSchema = z
  .string()
  .trim()
  .max(2048, "That URL is too long.")
  .refine((v) => {
    if (LOCAL_IMAGE.test(v) || LOCAL_AVATAR.test(v)) return true;
    try {
      const u = new URL(v);
      return u.protocol === "https:" && !u.username && !u.password;
    } catch {
      return false;
    }
  }, "Use an uploaded photo or an https:// image URL.");

export const genderSchema = z.enum(["MALE", "FEMALE", "NON_BINARY"]);
export const bubbleKindSchema = z.enum(["CAMPUS", "TOWN"]);
export const commentKindSchema = z.enum(["COMMENT", "ADVICE"]);

export const createProfileSchema = z.object({
  bubbleId: z.uuid("Choose a campus or town bubble."),
  displayName: trimmed(2, 40, "Name"),
  gender: genderSchema,
  affiliation: optionalTrimmed(40, "Affiliation"),
  bio: z.string().trim().max(280, "Bio must be at most 280 characters.").default(""),
  photoUrl: imageUrlSchema,
  consent: z.literal(true, { error: "Confirm this profile and photo are of you." }),
});
export type CreateProfileInput = z.infer<typeof createProfileSchema>;

export const updateProfileSchema = z
  .object({
    bubbleId: z.uuid(),
    displayName: trimmed(2, 40, "Name"),
    gender: genderSchema,
    affiliation: z.string().trim().max(40, "Affiliation must be at most 40 characters.").nullable(),
    bio: z.string().trim().max(280, "Bio must be at most 280 characters."),
    photoUrl: imageUrlSchema,
  })
  .partial();
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const rateSchema = z.object({
  value: z.number().int("Ratings are whole numbers.").min(0).max(100),
});

export const boostSchema = z.object({
  clicks: z.number().int().min(1).max(10),
});

export const commentSchema = z.object({
  kind: commentKindSchema.default("COMMENT"),
  body: trimmed(2, 500, "Comment"),
});

export const createBubbleSchema = z.object({
  name: trimmed(2, 48, "Bubble name"),
  description: z.string().trim().max(200, "Description must be at most 200 characters.").default(""),
  kind: bubbleKindSchema,
  badge: optionalTrimmed(24, "Badge"),
  logoUrl: imageUrlSchema.optional().or(z.literal("").transform(() => undefined)),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export type CreateBubbleInput = z.infer<typeof createBubbleSchema>;

export const createGroupSchema = z.object({
  name: trimmed(2, 32, "Group name"),
  description: z.string().trim().max(120, "Description must be at most 120 characters.").default(""),
});

export const messageSchema = z.object({
  body: trimmed(1, 500, "Message"),
});

export const REPORT_REASONS = [
  { id: "harassment", label: "Bullying or harassment" },
  { id: "hate", label: "Hate speech" },
  { id: "body_shaming", label: "Body shaming" },
  { id: "not_them", label: "Not the person pictured / impersonation" },
  { id: "minor", label: "May be under 18" },
  { id: "sexual", label: "Nudity or sexual content" },
  { id: "spam", label: "Spam or scam" },
  { id: "other", label: "Something else" },
] as const;

export const reportSchema = z.object({
  targetType: z.enum(["PROFILE", "COMMENT", "MESSAGE", "BUBBLE"]),
  targetId: z.uuid(),
  reason: z.enum(REPORT_REASONS.map((r) => r.id) as [string, ...string[]]),
  details: z.string().trim().max(500).default(""),
});

export const resolveReportSchema = z.object({
  action: z.enum(["dismiss", "hide", "restore", "delete", "ban"]),
});

export const FEED_SORTS = ["best", "males", "females", "lowest", "most_votes", "least_votes"] as const;
export type FeedSort = (typeof FEED_SORTS)[number];

export const feedQuerySchema = z.object({
  sort: z.enum(FEED_SORTS).default("best"),
  q: z.string().trim().max(60).optional(),
  cursor: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(60).default(24),
});

export const LEADERBOARDS = ["top_overall", "bottom_overall", "top_males", "top_females"] as const;
export type LeaderboardId = (typeof LEADERBOARDS)[number];

export const leaderboardQuerySchema = z.object({
  scope: z.enum(["national", "bubble"]).default("national"),
  bubble: z.string().trim().max(80).optional(),
  board: z.enum(LEADERBOARDS).default("top_overall"),
});

export const BUBBLE_SORTS = ["active", "highest", "lowest", "votes"] as const;
export type BubbleSort = (typeof BUBBLE_SORTS)[number];

export const bubbleRankingQuerySchema = z.object({
  sort: z.enum(BUBBLE_SORTS).default("active"),
});

export const searchQuerySchema = z.object({
  q: z.string().trim().min(1).max(60),
});

export const termsSchema = z.object({ accepted: z.literal(true) });

export const adSchema = z.object({
  title: trimmed(2, 80, "Title"),
  advertiser: z.string().trim().max(80).default(""),
  mediaUrl: imageUrlSchema,
  mediaType: z.enum(["image", "video"]),
  clickUrl: z
    .union([z.literal(""), z.url().refine((u) => u.startsWith("https://"), "Use an https:// link.")])
    .optional(),
  durationSeconds: z.number().int().min(5).max(60).default(10),
  rewardClicks: z.number().int().min(1).max(100).default(10),
});
