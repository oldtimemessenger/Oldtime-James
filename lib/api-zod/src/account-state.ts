import { z } from "zod/v4";

const stateId = z.string().trim().min(1).max(128);
const timestamp = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);

const helpItemSchema = z.object({
  lastShownAt: timestamp.optional(),
  viewedAt: timestamp.optional(),
  never: z.boolean().optional(),
  dismissed: z.number().int().min(0).max(1000).optional(),
  actions: z.number().int().min(0).max(1000).optional(),
}).strict();

export const BLOCKED_PROFILE_IMAGE_FILES = [
  "courtside-daily.png",
  "beyond-the-pitch.png",
  "the-world-unfiltered.png",
  "love-in-frames.png",
  "destination-z.png",
  "wedding-whispers.png",
  "internet-after-dark.png",
  "africa-to-the-world.png",
  "fresh-finds.png",
  "tomorrow-trending.png",
] as const;
export const RESERVED_PROFILE_IMAGE_ERROR = "This image cannot be used as an account photo.";

const blockedProfileImageFiles = new Set<string>(BLOCKED_PROFILE_IMAGE_FILES);
export function isBlockedProfileImage(value: string): boolean {
  try {
    const path = decodeURIComponent(value.trim().split(/[?#]/, 1)[0] || "").replace(/\\/g, "/");
    return blockedProfileImageFiles.has(path.slice(path.lastIndexOf("/") + 1).toLowerCase());
  } catch {
    return false;
  }
}

const profileMedia = z.string().trim().min(1).max(1024)
  .refine(value => !/^(data:|blob:)/i.test(value), "Upload profile media to your account before saving.")
  .refine(value => !isBlockedProfileImage(value), RESERVED_PROFILE_IMAGE_ERROR);

const profileInterest = z.enum([
  "fitness", "running", "basketball", "yoga", "college", "nursing", "cybersecurity",
  "study-groups", "gaming", "cars", "music", "photography", "fashion", "food",
  "tech", "travel", "art", "pets", "beauty",
  // Keep values saved by older clients valid while profiles are edited.
  "Sports", "Photography", "Music", "Comedy", "Food", "Travel", "Fitness",
  "News", "Art", "Gaming", "Fashion", "Technology",
]);

export const profileSchema = z.object({
  displayName: z.string().trim().min(1).max(64).optional(),
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,24}$/).optional(),
  bio: z.string().max(280).optional(),
  city: z.string().max(80).optional(),
  birthday: z.string().max(10).refine(value => !value || /^\d{4}-\d{2}-\d{2}$/.test(value)).optional(),
  interests: z.array(profileInterest).max(12).optional(),
  avatar: profileMedia.optional(),
  cover: profileMedia.nullable().optional(),
  avatarPreset: z.string().max(120).nullable().optional(),
  profileVisibility: z.object({ city: z.boolean(), interests: z.boolean() }).strict().optional(),
}).strict();

const profileCollectionItemSchema = z.object({
  id: stateId,
  postId: stateId,
  mediaIndex: z.number().int().min(0).max(100),
  caption: z.string().max(500).optional(),
  createdAt: timestamp,
}).strict();

const profileCollectionSchema = z.object({
  id: stateId,
  type: z.enum(["album", "memory"]),
  title: z.string().trim().min(1).max(60),
  description: z.string().max(220).optional(),
  coverUri: profileMedia.optional(),
  coverTemplate: z.enum(["mono", "red", "night"]).optional(),
  coverPosition: z.object({
    x: z.number().min(0).max(100),
    y: z.number().min(0).max(100),
    zoom: z.number().min(1).max(2),
  }).strict().optional(),
  createdAt: timestamp,
  items: z.array(profileCollectionItemSchema).max(300),
}).strict();

const legacyPostArchiveSchema = z.object({
  sourcePostId: stateId,
  legacyLikes: z.array(z.string().max(128)).max(500),
  legacySaves: z.array(z.string().max(128)).max(500),
  comments: z.array(z.object({
    id: stateId,
    authorId: z.string().max(128),
    username: z.string().max(24),
    displayName: z.string().max(64),
    body: z.string().max(1000),
    createdAt: timestamp,
    parentId: stateId.nullable().optional(),
  }).strict()).max(200),
}).strict();

export const accountStateSchema = z.object({
  archivePreferences: z.object({
    autoArchiveStories: z.boolean(),
    allowPostArchive: z.boolean(),
  }).strict().optional(),
  savedPostIds: z.array(stateId).max(5000).optional(),
  savedAudioIds: z.array(stateId).max(2000).optional(),
  commentFavorites: z.array(stateId).max(5000).optional(),
  savedCollections: z.array(z.object({
    id: stateId,
    name: z.string().trim().min(1).max(60),
    postIds: z.array(stateId).max(5000),
    createdAt: timestamp,
  }).strict()).max(200).optional(),
  profileCollections: z.array(profileCollectionSchema).max(100).optional(),
  interestPreferences: z.object({
    enabled: z.boolean(),
    selected: z.array(z.enum([
      "Sports", "Photography", "Music", "Comedy", "Food", "Travel",
      "Fitness", "News", "Art", "Gaming", "Fashion", "Technology",
    ])).max(12),
  }).strict().nullable().optional(),
  notificationEnabled: z.boolean().optional(),
  soundReuseEnabled: z.boolean().optional(),
  taggingPreferences: z.object({
    whoCanTag: z.enum(["everyone", "following", "nobody"]),
  }).strict().optional(),
  chatPreferences: z.object({
    readReceipts: z.boolean(),
    lastSeen: z.enum(["everyone", "contacts", "nobody"]),
  }).strict().optional(),
  helpPreferences: z.object({
    lastShownAt: timestamp,
    paused: z.boolean(),
    items: z.record(z.string(), helpItemSchema).refine(items => Object.keys(items).length <= 50),
  }).strict().optional(),
  emojiPreferences: z.object({
    recent: z.array(z.string().min(1).max(16)).max(32),
    favorites: z.array(z.string().min(1).max(16)).max(128),
  }).strict().optional(),
  creativeToolsTheme: z.enum(["dark", "light"]).optional(),
  callFeedback: z.array(z.object({
    id: stateId,
    user: z.string().uuid(),
    peer: z.string().uuid(),
    convoId: stateId,
    video: z.boolean(),
    durationSeconds: z.number().int().min(0).max(24 * 60 * 60),
    rating: z.number().int().min(1).max(5),
    message: z.string().max(240),
    created: timestamp,
  }).strict()).max(1000).optional(),
  legacyPostArchives: z.array(legacyPostArchiveSchema).max(500).optional(),
  profile: profileSchema.optional(),
}).strict();

export const profileUpdateSchema = z.object({
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,24}$/),
  displayName: z.string().trim().min(1).max(64),
  email: z.string().trim().email().max(254),
  profile: profileSchema,
}).strict();
