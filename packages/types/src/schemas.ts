import { z } from 'zod';

// ---------- Project ----------

export const ProjectTypeSchema = z.enum(['beat', 'project']);
export type ProjectTypeValue = z.infer<typeof ProjectTypeSchema>;

export const CreateProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  tempo: z.number().int().min(20).max(400).optional(),
  key: z.string().max(20).optional(),
  genre: z.string().max(60).optional(),
  timeSignature: z.string().max(10).optional(),
  projectType: ProjectTypeSchema.optional(),
});
export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;

export const UpdateProjectSchema = CreateProjectSchema.partial();
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;

// ---------- Track ----------

export const TrackTypeSchema = z.enum(['audio', 'midi', 'drum', 'loop', 'fullmix']);

export const CreateTrackSchema = z.object({
  name: z.string().min(1).max(200),
  type: TrackTypeSchema,
  fileId: z.string().uuid().nullable().optional(),
  fileName: z.string().max(500).nullable().optional(),
  volume: z.number().min(0).max(2).optional(),
  pan: z.number().min(-1).max(1).optional(),
  bpm: z.number().min(20).max(400).nullable().optional(),
  key: z.string().max(20).nullable().optional(),
  position: z.number().min(0).optional(),
});
export type CreateTrackInput = z.infer<typeof CreateTrackSchema>;

export const UpdateTrackSchema = CreateTrackSchema.partial().extend({
  muted: z.boolean().optional(),
  soloed: z.boolean().optional(),
});
export type UpdateTrackInput = z.infer<typeof UpdateTrackSchema>;

// ---------- Auth ----------

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof LoginSchema>;

export const SignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
  displayName: z.string().min(1).max(80),
});
export type SignupInput = z.infer<typeof SignupSchema>;

// ---------- Invitations ----------

export const InviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['editor', 'viewer']).default('editor'),
});
export type InviteMemberInput = z.infer<typeof InviteMemberSchema>;

// ---------- Social ----------

export const CreateSocialPostSchema = z.object({
  text: z.string().min(1).max(2000),
  projectId: z.string().uuid().optional(),
  audioFileId: z.string().optional(),
});
export type CreateSocialPostInput = z.infer<typeof CreateSocialPostSchema>;

export const SocialReactionSchema = z.object({
  emoji: z.enum(['🔥', '🎧', '🎤', '💯', '❤️']),
});
export type SocialReactionInput = z.infer<typeof SocialReactionSchema>;

// ---------- Chat (WebSocket) ----------

export const ChatSendSchema = z.object({
  projectId: z.string().min(1),
  text: z.string().min(1).max(4000),
});
export type ChatSendInput = z.infer<typeof ChatSendSchema>;

export const ChatDeleteSchema = z.object({
  projectId: z.string().min(1),
  timestamp: z.number().int(),
  messageId: z.string().optional(),
});
export type ChatDeleteInput = z.infer<typeof ChatDeleteSchema>;

// ---------- WebRTC signalling (WebSocket) ----------

export const WebRtcSignalSchema = z.object({
  targetUserId: z.string().min(1),
  projectId: z.string().min(1),
  payload: z.unknown(),
});
export type WebRtcSignalInput = z.infer<typeof WebRtcSignalSchema>;
