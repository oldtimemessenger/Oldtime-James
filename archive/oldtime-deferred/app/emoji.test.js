import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { defaultEmoji, defaultEmojiList, emojiFlags } from "./emoji.js";

const read = name => readFileSync(new URL(name, import.meta.url), "utf8");

test("all skin modifiers normalize to the default emoji without breaking joined sequences", () => {
  for (const tone of ["🏻", "🏼", "🏽", "🏾", "🏿"]) {
    assert.equal(defaultEmoji(`👍${tone}`), "👍");
    assert.equal(defaultEmoji(`👩${tone}‍💻`), "👩‍💻");
    assert.equal(defaultEmoji(`👨${tone}‍👩${tone}‍👧${tone}‍👦${tone}`), "👨‍👩‍👧‍👦");
  }
  for (const emoji of ["🥰", "❤️", "🏳️‍🌈", "🇭🇹", "🐻‍❄️", "😶‍🌫️", "🩷"]) {
    assert.equal(defaultEmoji(emoji), emoji);
  }
});

test("old recents and favorites retain their selection with duplicate skin variants removed", () => {
  assert.deepEqual(defaultEmojiList(["👍🏾", "😂", null, "👍🏻", "❤️", "👩🏽‍💻"], 32), ["👍", "😂", "❤️", "👩‍💻"]);
  assert.deepEqual(defaultEmojiList(["😀", "🥰", "😎"], 2), ["😀", "🥰"]);
});

test("Flags include all country/territory entries, special flags and the three UK subdivision sequences", () => {
  assert.equal(emojiFlags.length, 269);
  assert.equal(new Set(emojiFlags).size, 269);
  for (const flag of ["🇭🇹", "🇺🇸", "🇬🇧", "🇦🇨", "🇨🇵", "🇨🇶", "🇩🇬", "🇪🇦", "🇮🇨", "🇹🇦", "🇪🇺", "🇺🇳", "🏳️‍🌈", "🏳️‍⚧️", "🏴‍☠️"]) assert.ok(emojiFlags.includes(flag), flag);
  for (const tag of ["gbeng", "gbsct", "gbwls"]) {
    const flag = "🏴" + [...tag].map(char => String.fromCodePoint(0xE0000 + char.charCodeAt(0))).join("") + String.fromCodePoint(0xE007F);
    assert.ok(emojiFlags.includes(flag));
    assert.equal(defaultEmoji(flag), flag);
  }
  assert.match(read("styles.css"), /--font-emoji-flags:\s*"Apple Color Emoji",\s*"Noto Color Emoji"/);
});

test("both pickers retain categories, flags, search, recents, favorites and stickers without skin controls", () => {
  const source = read("emoji.js");
  assert.doesNotMatch(source, /Skin tone|emoji-tone|toneNames|selectedTone|toneable/);
  for (const category of ["Smileys", "People", "Nature", "Food", "Activities", "Travel", "Objects", "Symbols", "Flags"]) {
    assert.ok(source.includes(`"${category}"`), `Missing ${category}`);
  }
  for (const feature of ["emoji-search", "Recent", 'data-mode="favorites"', 'data-mode="stickers"', "options.onSticker", "target.setRangeText"]) {
    assert.ok(source.includes(feature), `Missing ${feature}`);
  }
  assert.match(read("chat.js"), /import\s*\{\s*openEmojiPicker\s*\}\s*from\s*"\.\/emoji\.js"/);
  assert.match(read("app.js"), /import\s*\{\s*openEmojiPicker,\s*closeEmojiPicker\s*\}\s*from\s*"\.\/emoji\.js"/);
});

test("picker glyphs, reactions, chat categories and ordinary text share Apple-first emoji rendering", () => {
  const css = read("styles.css");
  assert.match(css, /--font-emoji:\s*"Apple Color Emoji",\s*"Segoe UI Emoji",\s*"Noto Color Emoji"/);
  assert.match(css, /--font:[^;]*var\(--font-emoji\)/);
  assert.match(css, /\.emoji,\s*\.reacts,\s*\.chat-emoji-categories button\s*\{[^}]*font-family:\s*var\(--font-emoji\),\s*var\(--font\)/);
  assert.doesNotMatch(css, /font-family:\s*"Noto Color Emoji"/);
});

test("emoji tiles have no overlapping favorite stars while saved Favorites remain accessible", () => {
  const source = read("emoji.js");
  assert.doesNotMatch(source, /emoji-favorite-toggle|Tap a star|[★☆]/);
  assert.doesNotMatch(read("styles.css"), /emoji-favorite-toggle/);
  assert.match(source, /data-mode="favorites"/);
  assert.match(source, /button\.oncontextmenu/);
  assert.match(source, /setTimeout\(toggleFavorite, 550\)/);
  assert.match(source, /Date\.now\(\) < suppressClickUntil/);
});

function exactProperty(css, selector, property) {
  let value;
  for (const [, selectors, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!selectors.split(",").some(item => item.trim() === selector)) continue;
    const next = body.match(new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`))?.[1];
    if (next) value = next.trim();
  }
  return value;
}

test("Blast's specific hub and chat button rules do not override rounded corners with zero", () => {
  const blast = read("blast.css");
  for (const button of ["blast-primary", "blast-secondary", "blast-quiet"]) {
    assert.equal(exactProperty(blast, `.blast-screen.blast-hub .${button}`, "border-radius"), "11px");
  }
  assert.equal(exactProperty(blast, ".blast-screen.blast-hub .blast-primary", "padding-left"), "12px");
  const notes = read("blast-video-notes.css");
  for (const button of ["bvn-record-cta", "bvn-share-submit"]) {
    assert.equal(exactProperty(notes, `.bvn-screen:not(.bvn-twitter-feed) .${button}`, "border-radius"), "12px");
  }
  assert.equal(exactProperty(notes, ".bvn-screen:not(.bvn-twitter-feed) .bvn-library-cta", "border-radius"), "10px");
});
