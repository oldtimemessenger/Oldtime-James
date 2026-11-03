# Status layouts and interactive stickers

## What changed

- Status media uses a portrait canvas, initially Fill, with an explicit Fit option.
- Background media, text, stickers and picture overlays can be positioned independently. Pointer gestures support drag and pinch sizing; stickers, text and picture overlays can also rotate.
- Overlay adds up to six JPEG, PNG or WebP pictures, including on a plain colour background. Each picture retains its aspect ratio and has remove/size controls and keyboard alternatives.
- The horizontal, closable sticker picker provides Questions and two Add Yours prompt templates. Questions uses a familiar prompt-and-reply card; Add Yours uses a compact prompt card with a clear Add Yours action. Every sticker can have an optional title of up to 60 characters.
- Questions starts with an editable “Ask me anything” prompt. Both Add Yours templates retain their distinct default prompts and shared participation threads, while using the same clean, white-and-blue Story card treatment.
- Preview and photo/video exports use the same composition. Interactive sticker positions are also sent as normalized metadata; overlay photo bytes are baked into the composition, not stored as database blobs.

## Private questions and public answers

Questions are stored separately from public replies. Only the Status owner can read the question inbox, including the sender's name. The sender sees a receipt, not anyone else's questions. The form explains that the owner may choose to publish the question in an answer without the sender's name.

The owner selects a question, chooses a camera shot, gallery media or colour background, then edits the answer and optional title. The original question is read-only and remains intact up to 300 characters. Public answer metadata does not include the asker's identity or private question identifier.

Questions are limited to five per sender per question sticker; an unchanged request ID is idempotent. Visibility, blocking, ownership and expiry are checked on the server. Expired questions cannot receive new submissions, while the owner retains private inbox access.

## Participation

Joining a visible active Trendsetters or Hey World sticker carries its original prompt into the Status chooser. The participant can edit their optional title and add their own media/layout. The server validates the source and records the thread connection. The participant list includes only currently visible active Status entries, with pagination and no fabricated activity.

This does not restore the removed Get On Board, Campaign or automatic sound features.

## Infrastructure and release boundary

The implementation uses the existing Cloudflare Worker, D1 and R2. Additive migrations `0032_status_stickers_and_private_questions.sql` and `0033_status_mentions.sql` create sticker metadata, private questions and Status mentions without rewriting current user content. The existing content-mention kind constraint is preserved. Metadata retrieval is chunked below D1 statement-binding limits.

Only isolated local test storage has received these new schema changes. No live users, content or deployment were changed for this request. A Cloudflare release must apply both migrations before publishing the Worker and then Pages. The editor checks capabilities before uploading interactive Status media; an older or unmigrated backend must not silently drop sticker metadata or question/mention behavior.

## Artwork, layout and transient comments

The full uploaded artwork is shared by all publishers and participants, with transparent exteriors and editable wording fitted to each template. Text follows the template's internal tilt as well as the user's rotation, and scales with pinching. Literal ellipses in user text must not be mistaken for layout truncation.

The black, edge-to-edge Search/Discover media viewer retains compact controls. Its recent comments animate in and fade after a short interval; refresh must not restart previously expired comments. Tapping or scrolling pauses expiry and lets readers use the full conversation without deleting records. Timers are cleared when the viewer is disposed, and reduced-motion preferences are respected.
