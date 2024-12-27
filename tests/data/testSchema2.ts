import { z } from "zod";
export const UserProfileSchema = z.object({
  avatar_hash: z.string().description("Hash of the user's avatar"),
  image_72: z
    .string()
    .url()
    .description("URL of the user's 72x72 avatar image"),
  first_name: z.string().description("User's first name"),
  real_name: z.string().description("User's real name"),
  display_name: z.string().description("User's display name"),
  team: z.string().description("Team ID the user belongs to"),
  name: z.string().description("User's username"),
  is_restricted: z
    .boolean()
    .description("Flag indicating if the user is restricted"),
  is_ultra_restricted: z
    .boolean()
    .description("Flag indicating if the user is ultra-restricted"),
});
export const FileSchema = z.object({
  id: z.string().description("File ID"),
  created: z.number().description("File creation timestamp"),
  timestamp: z.number().description("File timestamp"),
  name: z.string().description("File name"),
  title: z.string().description("File title"),
  mimetype: z.string().description("MIME type of the file"),
  filetype: z.string().description("File type"),
  pretty_type: z.string().description("Pretty type of the file"),
  user: z.string().description("User ID who uploaded the file"),
  user_team: z
    .string()
    .description("Team ID of the user who uploaded the file"),
  editable: z.boolean().description("Flag indicating if the file is editable"),
  size: z.number().description("File size in bytes"),
  mode: z.string().description("Mode of the file"),
  is_external: z
    .boolean()
    .description("Flag indicating if the file is external"),
  external_type: z.string().nullable().description("External type of the file"),
  is_public: z.boolean().description("Flag indicating if the file is public"),
  public_url_shared: z
    .boolean()
    .description("Flag indicating if the public URL is shared"),
  display_as_bot: z
    .boolean()
    .description("Flag indicating if the file is displayed as bot"),
  username: z.string().nullable().description("Username of the file uploader"),
  url_private: z.string().url().description("Private URL for the file"),
  url_private_download: z
    .string()
    .url()
    .description("Private URL for downloading the file"),
  permalink: z.string().url().description("Permalink for the file"),
  permalink_public: z
    .string()
    .url()
    .description("Public permalink for the file"),
  edit_link: z
    .string()
    .url()
    .optional()
    .description("Link for editing the file"),
  is_starred: z.boolean().description("Flag indicating if the file is starred"),
  has_rich_preview: z
    .boolean()
    .description("Flag indicating if the file has a rich preview"),
  file_access: z.string().description("Access level of the file"),
  media_display_type: z.string().optional().description("Media display type"),
  audio_wave_samples: z
    .array(z.number())
    .optional()
    .description("Audio wave samples"),
  duration_ms: z
    .number()
    .optional()
    .description("Duration of audio in milliseconds"),
  aac: z.string().url().optional().description("AAC file URL"),
  vtt: z.string().url().optional().description("VTT file URL"),
  transcription: z
    .object({
      status: z.string().description("Status of the transcription"),
      locale: z.string().description("Locale of the transcription"),
      preview: z
        .object({
          content: z
            .string()
            .description("Preview content of the transcription"),
          has_more: z
            .boolean()
            .description("Flag if the transcription has more content"),
        })
        .description("Preview data of the transcription"),
    })
    .optional()
    .description("Transcription details"),
});
export const AttachmentSchema = z.object({
  id: z.number().description("Attachment ID"),
  footer_icon: z
    .string()
    .url()
    .optional()
    .description("URL of the footer icon"),
  ts: z.number().optional().description("Attachment timestamp"),
  color: z.string().optional().description("Attachment color in HEX"),
  bot_id: z
    .string()
    .optional()
    .description("Bot ID associated with the attachment"),
  app_unfurl_url: z.string().url().optional().description("App unfurl URL"),
  is_app_unfurl: z
    .boolean()
    .optional()
    .description("Flag if the attachment is an app unfurl"),
  app_id: z.string().optional().description("App ID related to the attachment"),
  fallback: z.string().description("Fallback text for the attachment"),
  text: z.string().description("Attachment text content"),
  title: z.string().optional().description("Title of the attachment"),
  title_link: z
    .string()
    .url()
    .optional()
    .description("URL link for the attachment title"),
  footer: z.string().optional().description("Footer text of the attachment"),
  service_icon: z.string().url().optional().description("Service icon URL"),
  thumb_url: z.string().url().optional().description("Thumbnail URL"),
  thumb_width: z.number().optional().description("Thumbnail width"),
  thumb_height: z.number().optional().description("Thumbnail height"),
  video_html: z.string().optional().description("Video HTML embed code"),
  video_html_width: z.number().optional().description("Video HTML width"),
  video_html_height: z.number().optional().description("Video HTML height"),
  original_url: z
    .string()
    .url()
    .optional()
    .description("Original URL of the media"),
  author_name: z.string().optional().description("Name of the author"),
  author_link: z
    .string()
    .url()
    .optional()
    .description("Link to the author's profile"),
  author_icon: z
    .string()
    .url()
    .optional()
    .description("Icon URL of the author"),
  author_id: z.string().optional().description("ID of the author"),
  service_name: z
    .string()
    .optional()
    .description("Name of the service providing the media"),
  service_url: z.string().url().optional().description("URL of the service"),
  text_: z
    .string()
    .optional()
    .description("Text of the message in the attachment"),
  from_url: z
    .string()
    .url()
    .optional()
    .description("URL from which the media was retrieved"),
  channel_id: z
    .string()
    .optional()
    .description("Channel ID related to the attachment"),
  channel_team: z
    .string()
    .optional()
    .description("Team ID related to the channel"),
  is_msg_unfurl: z
    .boolean()
    .optional()
    .description("Flag if the message is an unfurl"),
  message_blocks: z
    .array(
      z.object({
        team: z.string().optional().description("Team ID"),
        channel: z.string().optional().description("Channel ID"),
        ts: z.string().optional().description("Timestamp"),
        message: z
          .object({
            blocks: z
              .array(
                z.object({
                  type: z.string().description("Block type"),
                  block_id: z.string().optional().description("Block ID"),
                  elements: z
                    .array(
                      z.object({
                        type: z.string().description("Element type"),
                        text: z.string().optional().description("Text content"),
                        user_id: z.string().optional().description("User ID"),
                        url: z
                          .string()
                          .url()
                          .optional()
                          .description("URL in the attachment"),
                        elements: z
                          .array(z.any())
                          .optional()
                          .description("Nested elements"),
                        emoji: z.string().optional().description("Emoji name"),
                        style: z
                          .object({
                            bold: z
                              .boolean()
                              .optional()
                              .description("Bold style"),
                            code: z
                              .boolean()
                              .optional()
                              .description("Code style"),
                            italic: z
                              .boolean()
                              .optional()
                              .description("Italic style"),
                          })
                          .optional()
                          .description("Text style"),
                      })
                    )
                    .description("List of elements within the block"),
                })
              )
              .description("List of blocks within the message"),
          })
          .description("Message details"),
      })
    )
    .optional()
    .description("Blocks of the unfurled message"),
});
export const BlockElementSchema = z.object({
  type: z.string().description("Type of the block element"),
  text: z.string().optional().description("Text within the block"),
  url: z.string().url().optional().description("URL associated with the block"),
  elements: z
    .array(
      z.object({
        type: z.string().description("Element type within the block"),
        text: z
          .string()
          .optional()
          .description("Text content within the block"),
        user_id: z.string().optional().description("User ID mentioned"),
        url: z.string().url().optional().description("URL in the rich text"),
        emoji: z.string().optional().description("Emoji shorthand name"),
        name: z.string().optional().description("Name of the emoji"),
        unicode: z.string().optional().description("Unicode of the emoji"),
      })
    )
    .optional()
    .description("Nested elements"),
  indent: z.number().optional().description("Indentation level"),
  border: z.number().optional().description("Border style"),
  style: z.string().optional().description("List style type"),
  offset: z.number().optional().description("Offset for list elements"),
  children: z.array(z.any()).optional().description("Child elements"),
});
export const BlockSchema = z.object({
  type: z.string().description("Type of the block"),
  block_id: z.string().optional().description("ID of the block"),
  elements: z
    .array(BlockElementSchema)
    .description("Elements within the block"),
});
export const ReactionSchema = z.object({
  name: z.string().description("Name of the reaction"),
  users: z.array(z.string()).description("List of user IDs who reacted"),
  count: z.number().description("Count of reactions"),
});
export const MessageSchema = z.object({
  user: z.string().description("User ID of the message creator"),
  type: z.string().description("Type of the message"),
  ts: z.string().description("Timestamp of the message"),
  client_msg_id: z.string().optional().description("Client-side message ID"),
  text: z.string().description("Text content of the message"),
  team: z.string().description("Team ID associated with the message"),
  user_team: z.string().description("User team ID"),
  source_team: z.string().description("Source team ID"),
  user_profile: UserProfileSchema.optional().description(
    "Profile information of the user"
  ),
  thread_ts: z
    .string()
    .optional()
    .description("Thread timestamp for threaded messages"),
  parent_user_id: z
    .string()
    .optional()
    .description("Parent user ID in a thread"),
  edited: z
    .object({
      user: z.string().description("User who edited the message"),
      ts: z.string().description("Timestamp of the edit"),
    })
    .optional()
    .description("Edit information"),
  display_as_bot: z
    .boolean()
    .optional()
    .description("Flag indicating if the message displays as bot"),
  reply_count: z
    .number()
    .optional()
    .description("Number of replies to the message"),
  reply_users_count: z
    .number()
    .optional()
    .description("Number of users who replied"),
  latest_reply: z
    .string()
    .optional()
    .description("Timestamp of the latest reply"),
  reply_users: z
    .array(z.string())
    .optional()
    .description("List of user IDs who replied"),
  replies: z
    .array(
      z.object({
        user: z.string().description("User ID who replied"),
        ts: z.string().description("Timestamp of the reply"),
      })
    )
    .optional()
    .description("Replies to the message"),
  is_locked: z
    .boolean()
    .optional()
    .description("Flag indicating if the thread is locked"),
  subscribed: z
    .boolean()
    .optional()
    .description("Flag indicating subscription to the thread"),
  last_read: z.string().optional().description("Timestamp of the last read"),
  subtype: z.string().optional().description("Subtype of the message"),
  files: z
    .array(FileSchema)
    .optional()
    .description("Files associated with the message"),
  blocks: z
    .array(BlockSchema)
    .optional()
    .description("Blocks within the message"),
  attachments: z
    .array(AttachmentSchema)
    .optional()
    .description("Attachments of the message"),
  reactions: z
    .array(ReactionSchema)
    .optional()
    .description("Reactions to the message"),
});
