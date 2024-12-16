import { z } from "zod";

let a = 12;

const userProfileSchema = z.object({
  avatar_hash: z.string(),
  image_72: z.string().url(),
  first_name: z.string(),
  real_name: z.string(),
  display_name: z.string(),
  team: z.string(),
  name: z.string(),
  is_restricted: z.boolean(),
  is_ultra_restricted: z.boolean(),
});

callFunc();

const richTextSectionElementSchema = z.object({
  type: z.literal("text").or(z.literal("link")),
  text: z.string().optional(),
  url: z.string().url().optional(),
});

const richTextSectionSchema = z.object({
  type: z.literal("rich_text_section"),
  elements: z.array(richTextSectionElementSchema),
});

const richTextListSchema = z.object({
  type: z.literal("rich_text_list"),
  elements: z.array(richTextSectionSchema),
  style: z.literal("bullet"),
  indent: z.number(),
  border: z.number(),
});

const richTextElementSchema = z.object({
  type: z.literal("rich_text"),
  block_id: z.string(),
  elements: z.array(richTextSectionSchema.or(richTextListSchema)),
});

const videoBlockSchema = z.object({
  type: z.literal("video"),
  block_id: z.string(),
  video_url: z.string().url(),
  thumbnail_url: z.string().url(),
  alt_text: z.string(),
  title: z.object({
    type: z.literal("plain_text"),
    text: z.string(),
    emoji: z.boolean(),
  }),
  title_url: z.string().url(),
  author_name: z.string(),
  provider_name: z.string(),
  provider_icon_url: z.string().url(),
});

const sectionBlockSchema = z.object({
  type: z.literal("section"),
  block_id: z.string(),
  text: z.object({
    type: z.literal("plain_text"),
    text: z.string(),
    emoji: z.boolean(),
  }),
});

const attachmentSchema = z.object({
  id: z.number(),
  blocks: z.array(videoBlockSchema.or(sectionBlockSchema)),
  fallback: z.string(),
  bot_id: z.string(),
  app_unfurl_url: z.string().url(),
  is_app_unfurl: z.boolean(),
  app_id: z.string(),
});

const messageSchema = z.object({
  user: z.string(),
  type: z.literal("message"),
  ts: z.string(),
  client_msg_id: z.string(),
  text: z.string(),
  team: z.string(),
  user_team: z.string(),
  source_team: z.string(),
  user_profile: userProfileSchema,
  attachments: z.array(attachmentSchema).optional(),
  blocks: z.array(richTextElementSchema),
  edited: z
    .object({
      user: z.string(),
      ts: z.string(),
    })
    .optional(),
  thread_ts: z.string().optional(),
  parent_user_id: z.string().optional(),
});

export default messageSchema;
