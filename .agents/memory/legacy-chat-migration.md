---
name: Legacy chat migration
description: Privacy and authorship rules for historical device-only chat transfers.
---

Historical conversations that were stored on one device must become private, read-only archives owned by the account that imports them. Do not insert old messages into shared chat tables as though former participants sent them from current accounts. Remove the device copy only after the complete cloud archive and its media have been read back and verified.

**Why:** This preserves message authorship and privacy while moving legacy history between devices.

**How to apply:** Keep archive reads, writes, and deletes owner-scoped; use normal shared-chat behavior only for new conversations.

Never identify legacy conversations solely by the absence of server confirmation. A newly opened cloud conversation can still be awaiting its first server write.

**Why:** Automatic archiving otherwise races with typing and removes the open conversation, breaking drafts and sends.

**How to apply:** Explicitly distinguish pending new shared conversations from historical sources before running migration; create the server conversation before reading history or starting a call.
