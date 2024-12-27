import { z } from "zod";

const UserProfileSchema = z.object({
  avatar_hash: z.string().describe("Hash of the user's avatar."),
  image_72: z.string().url().describe("URL of the user's avatar image (72px)."),
  first_name: z
    .string()
    .nullable()
    .describe("The user's first name.")
    .optional(),
  real_name: z.string().describe("The user's full real name."),
  display_name: z.string().describe("The user's display name."),
  team: z.string().describe("The ID of the team the user belongs to."),
  name: z.string().describe("The user's username."),
  is_restricted: z.boolean().describe("Indicates if the user is restricted."),
  is_ultra_restricted: z
    .boolean()
    .describe("Indicates if the user is ultra-restricted."),
});

const EditedSchema = z
  .object({
    user: z.string().describe("The ID of the user who edited the message."),
    ts: z.string().describe("Timestamp of the edit."),
  })
  .optional();

const ReplySchema = z.object({
  user: z.string().describe("The ID of the user who replied."),
  ts: z.string().describe("Timestamp of the reply."),
});

const RichTextElementSchema = z
  .object({
    type: z
      .literal("text")
      .or(z.literal("link"))
      .or(z.literal("user"))
      .or(z.literal("emoji")),
    text: z.string().optional(),
    url: z.string().optional(),
    user_id: z.string().optional(),
    name: z.string().optional(),
    unicode: z.string().optional(),
    style: z.object({ bold: z.boolean().optional() }).optional(),
  })
  .describe("A single element of rich text");

const RichTextSectionSchema = z
  .object({
    type: z.literal("rich_text_section"),
    elements: z.array(RichTextElementSchema),
  })
  .describe(
    "A single section of rich text, containing an array of rich text elements"
  );

const RichTextListSchema = z
  .object({
    type: z.literal("rich_text_list"),
    elements: z.array(RichTextSectionSchema),
    style: z.enum(["bullet", "ordered"]).describe("Style of the list"),
    indent: z.number(),
    border: z.number(),
  })
  .describe("A single list of rich text sections");

const RichTextBlockSchema = z
  .object({
    type: z.literal("rich_text"),
    block_id: z.string(),
    elements: z.array(RichTextSectionSchema.or(RichTextListSchema)),
  })
  .describe(
    "A block of rich text, containing several elements such as lists and sections"
  );

const FileSchema = z
  .object({
    id: z.string().describe("The unique ID of the file."),
    created: z.number().describe("The timestamp when the file was created."),
    timestamp: z.number().describe("The timestamp when the file was uploaded."),
    name: z.string().describe("The name of the file."),
    title: z.string().describe("The title of the file."),
    mimetype: z.string().describe("The MIME type of the file."),
    filetype: z.string().describe("The type of the file (e.g., HTML, PNG)."),
    pretty_type: z.string().describe("A human-readable type of the file."),
    user: z.string().describe("The ID of the user who uploaded the file."),
    user_team: z.string().describe("The ID of the team the user belongs to."),
    editable: z.boolean().describe("Indicates if the file is editable."),
    size: z.number().describe("The size of the file in bytes."),
    mode: z.string().describe("The mode of the file (e.g., hosted, snippet)."),
    is_external: z.boolean().describe("Indicates if the file is external."),
    external_type: z
      .string()
      .nullable()
      .describe("The type of external file.")
      .optional(),
    is_public: z.boolean().describe("Indicates if the file is public."),
    public_url_shared: z
      .boolean()
      .describe("Indicates if the public URL of the file is shared."),
    display_as_bot: z
      .boolean()
      .describe("Indicates if the file was uploaded by a bot."),
    username: z
      .string()
      .nullable()
      .describe("The username that uploaded the file.")
      .optional(),
    transcription: z
      .object({
        status: z
          .string()
          .describe("The transcription status (e.g., complete)."),
        locale: z
          .string()
          .describe("The locale of the transcription (e.g., en-US)."),
        preview: z
          .object({
            content: z
              .string()
              .describe("A preview of the transcription content."),
            has_more: z
              .boolean()
              .describe("Indicates if there is more transcription content."),
          })
          .optional(),
      })
      .optional(),
    url_private: z.string().url().describe("The private URL of the file."),
    url_private_download: z
      .string()
      .url()
      .describe("The private URL for downloading the file."),
    vtt: z
      .string()
      .url()
      .optional()
      .describe("The URL of the VTT file for audio/video transcriptions.")
      .nullable(),
    duration_ms: z
      .number()
      .optional()
      .describe("Duration of audio file in milliseconds"),
    aac: z
      .string()
      .url()
      .optional()
      .describe("The URL of the AAC file for audio/video")
      .nullable(),
    audio_wave_samples: z
      .array(z.number())
      .optional()
      .describe("Array of audio wave sample data.")
      .nullable(),
    media_display_type: z
      .string()
      .optional()
      .describe("How to display media file"),
    permalink: z
      .string()
      .url()
      .describe("Permalink to the file within the slack workspace"),
    permalink_public: z
      .string()
      .url()
      .describe("Permalink to the file for the public"),
    is_starred: z.boolean().describe("Indicates if the file is starred."),
    has_rich_preview: z
      .boolean()
      .describe("Indicates if the file has rich preview"),
    edit_link: z
      .string()
      .url()
      .optional()
      .describe("The URL for editing the file snippet.")
      .nullable(),
    file_access: z.string().describe("The file access setting"),
    thumb_64: z
      .string()
      .url()
      .optional()
      .describe("URL for a 64px thumbnail")
      .nullable(),
    thumb_80: z
      .string()
      .url()
      .optional()
      .describe("URL for a 80px thumbnail")
      .nullable(),
    thumb_360: z
      .string()
      .url()
      .optional()
      .describe("URL for a 360px thumbnail")
      .nullable(),
    thumb_360_w: z
      .number()
      .optional()
      .describe("Width of the 360px thumbnail")
      .nullable(),
    thumb_360_h: z
      .number()
      .optional()
      .describe("Height of the 360px thumbnail")
      .nullable(),
    thumb_480: z
      .string()
      .url()
      .optional()
      .describe("URL for a 480px thumbnail")
      .nullable(),
    thumb_480_w: z
      .number()
      .optional()
      .describe("Width of the 480px thumbnail")
      .nullable(),
    thumb_480_h: z
      .number()
      .optional()
      .describe("Height of the 480px thumbnail")
      .nullable(),
    thumb_160: z
      .string()
      .url()
      .optional()
      .describe("URL for a 160px thumbnail")
      .nullable(),
    thumb_720: z
      .string()
      .url()
      .optional()
      .describe("URL for a 720px thumbnail")
      .nullable(),
    thumb_720_w: z
      .number()
      .optional()
      .describe("Width of the 720px thumbnail")
      .nullable(),
    thumb_720_h: z
      .number()
      .optional()
      .describe("Height of the 720px thumbnail")
      .nullable(),
    thumb_800: z
      .string()
      .url()
      .optional()
      .describe("URL for a 800px thumbnail")
      .nullable(),
    thumb_800_w: z
      .number()
      .optional()
      .describe("Width of the 800px thumbnail")
      .nullable(),
    thumb_800_h: z
      .number()
      .optional()
      .describe("Height of the 800px thumbnail")
      .nullable(),
    thumb_960: z
      .string()
      .url()
      .optional()
      .describe("URL for a 960px thumbnail")
      .nullable(),
    thumb_960_w: z
      .number()
      .optional()
      .describe("Width of the 960px thumbnail")
      .nullable(),
    thumb_960_h: z
      .number()
      .optional()
      .describe("Height of the 960px thumbnail")
      .nullable(),
    thumb_1024: z
      .string()
      .url()
      .optional()
      .describe("URL for a 1024px thumbnail")
      .nullable(),
    thumb_1024_w: z
      .number()
      .optional()
      .describe("Width of the 1024px thumbnail")
      .nullable(),
    thumb_1024_h: z
      .number()
      .optional()
      .describe("Height of the 1024px thumbnail")
      .nullable(),
    original_w: z
      .number()
      .optional()
      .describe("Original width of the image")
      .nullable(),
    original_h: z
      .number()
      .optional()
      .describe("Original height of the image")
      .nullable(),
    thumb_tiny: z.string().optional().describe("Tiny thumbnail").nullable(),
  })
  .describe("A file object");
const ReactionSchema = z.object({
  name: z
    .string()
    .describe("The name of the reaction (e.g., white_check_mark)."),
  users: z.array(z.string()).describe("Array of user IDs who reacted."),
  count: z.number().describe("The count of users who reacted."),
});

const AttachmentSchema = z
  .object({
    from_url: z
      .string()
      .url()
      .optional()
      .describe("Original URL that generated the attachment")
      .nullable(),
    image_url: z
      .string()
      .url()
      .optional()
      .describe("URL of the image in the attachment")
      .nullable(),
    image_width: z
      .number()
      .optional()
      .describe("Width of the attachment image")
      .nullable(),
    image_height: z
      .number()
      .optional()
      .describe("Height of the attachment image")
      .nullable(),
    image_bytes: z
      .number()
      .optional()
      .describe("Size of the image in bytes")
      .nullable(),
    service_icon: z
      .string()
      .url()
      .optional()
      .describe("URL of the service icon for the attachment")
      .nullable(),
    id: z.number().describe("Attachment ID"),
    original_url: z
      .string()
      .url()
      .optional()
      .describe("Original url for the attachement")
      .nullable(),
    fallback: z.string().describe("Fallback text for the attachement"),
    text: z
      .string()
      .optional()
      .describe("Text within the attachement")
      .nullable(),
    title: z.string().optional().describe("Title of the attachment").nullable(),
    title_link: z
      .string()
      .url()
      .optional()
      .describe("URL of the attachment's title")
      .nullable(),
    service_name: z
      .string()
      .optional()
      .describe("Name of the service related to the attachment")
      .nullable(),
    author_name: z
      .string()
      .optional()
      .describe("Name of the author")
      .nullable(),
    author_link: z
      .string()
      .url()
      .optional()
      .describe("URL of the author")
      .nullable(),
    author_icon: z
      .string()
      .url()
      .optional()
      .describe("URL of the author's icon")
      .nullable(),
    author_subname: z
      .string()
      .optional()
      .describe("Author's subname")
      .nullable(),
    mrkdwn_in: z
      .array(z.string())
      .optional()
      .describe("Markdown options within the attachement")
      .nullable(),
    footer: z
      .string()
      .optional()
      .describe("Footer text for the attachement")
      .nullable(),
    ts: z
      .number()
      .optional()
      .describe("Timestamp of the attachment")
      .nullable(),
    color: z.string().optional().describe("Color of the attachment").nullable(),
    bot_id: z
      .string()
      .optional()
      .describe("Bot ID for the attachement")
      .nullable(),
    app_unfurl_url: z
      .string()
      .url()
      .optional()
      .describe("URL for the app unfurl")
      .nullable(),
    is_app_unfurl: z
      .boolean()
      .optional()
      .describe("Indicates if the attachement is part of an app unfurl")
      .nullable(),
    app_id: z
      .string()
      .optional()
      .describe("ID of the attachement app")
      .nullable(),
    message_blocks: z
      .array(
        z.object({
          team: z.string(),
          channel: z.string(),
          ts: z.string(),
          message: z.object({
            blocks: z.array(RichTextBlockSchema),
          }),
        })
      )
      .optional()
      .describe("Slack message blocks within the attachment")
      .nullable(),
    channel_id: z
      .string()
      .optional()
      .describe("Channel ID from the message block")
      .nullable(),
    channel_team: z
      .string()
      .optional()
      .describe("Team ID from the message block")
      .nullable(),
  })
  .describe("Attachment object from slack message");

const SlackMessageSchema = z
  .object({
    user: z
      .string()
      .optional()
      .describe("The ID of the user who sent the message.")
      .nullable(),
    type: z
      .string()
      .describe("The type of message (e.g., message, channel_join)."),
    ts: z.string().describe("Timestamp of the message."),
    edited: EditedSchema,
    client_msg_id: z
      .string()
      .describe("The client-generated unique ID of the message."),
    text: z.string().describe("The text content of the message.").nullable(),
    team: z
      .string()
      .optional()
      .describe("The ID of the team the message was sent in.")
      .nullable(),
    user_team: z
      .string()
      .optional()
      .describe("The ID of the user's team.")
      .nullable(),
    source_team: z
      .string()
      .optional()
      .describe("The ID of the source team for the message.")
      .nullable(),
    user_profile: UserProfileSchema.optional()
      .describe("The user profile of the message sender.")
      .nullable(),
    thread_ts: z
      .string()
      .optional()
      .describe("Timestamp of the thread the message belongs to.")
      .nullable(),
    reply_count: z
      .number()
      .optional()
      .describe("Number of replies to the message.")
      .nullable(),
    reply_users_count: z
      .number()
      .optional()
      .describe("Number of unique users who replied.")
      .nullable(),
    latest_reply: z
      .string()
      .optional()
      .describe("Timestamp of the latest reply.")
      .nullable(),
    reply_users: z
      .array(z.string())
      .optional()
      .describe("Array of user IDs who replied to the message.")
      .nullable(),
    replies: z
      .array(ReplySchema)
      .optional()
      .describe("Array of replies to the message.")
      .nullable(),
    is_locked: z
      .boolean()
      .optional()
      .describe("Indicates if the thread is locked.")
      .nullable(),
    subscribed: z
      .boolean()
      .optional()
      .describe("Indicates if the user is subscribed to the thread.")
      .nullable(),
    last_read: z
      .string()
      .optional()
      .describe("Timestamp of the last read.")
      .nullable(),
    blocks: z
      .array(RichTextBlockSchema)
      .optional()
      .describe("Slack message blocks")
      .nullable(),
    files: z
      .array(FileSchema)
      .optional()
      .describe("Array of files attached to the message.")
      .nullable(),
    upload: z
      .boolean()
      .optional()
      .describe("Indicates if the message is an upload.")
      .nullable(),
    display_as_bot: z
      .boolean()
      .optional()
      .describe("Indicates if the message was sent by a bot.")
      .nullable(),
    parent_user_id: z
      .string()
      .optional()
      .describe("ID of the user to which the message is replied to")
      .nullable(),
    reactions: z
      .array(ReactionSchema)
      .optional()
      .describe("Reactions in the message")
      .nullable(),
    subtype: z
      .literal("channel_join")
      .optional()
      .describe("Subtype of the message")
      .nullable(),
    attachments: z
      .array(AttachmentSchema)
      .optional()
      .describe("Array of attachments associated with the message")
      .nullable(),
  })
  .describe("A slack message object");

export type SlackMessageType = z.infer<typeof SlackMessageSchema>;
export const SlackMessageArraySchema = z.array(SlackMessageSchema);
export type SlackMessageArrayType = z.infer<typeof SlackMessageArraySchema>;
