const emojiSequence = /(?:\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?)*|\p{Regional_Indicator}{2}|[0-9#*]\uFE0F?\u20E3)/gu;
export function isPlainEmojiMessage(message) {
  if (!["text", "sticker"].includes(message.kind)) return false;
  const text = String(message.body || "").trim();
  // A wave is a normal greeting, not an oversized sticker.
  if (!text || /^👋(?:\p{Emoji_Modifier})?$/u.test(text)) return false;
  return text.replace(emojiSequence, "").trim() === "";
}
