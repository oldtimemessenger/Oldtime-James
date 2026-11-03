const paths = {
  home: '<path d="m3 10 9-7 9 7v10h-6v-7H9v7H3z"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/>',
  comment: '<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7A8.4 8.4 0 0 1 4 11.5 8.5 8.5 0 0 1 8.7 3.9a8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5z"/>',
  share: '<path d="M12 16.5H6.5C3.4 16.5.4 18 .4 20.5Q.4 16.7 2.4 15.3C4.2 12 7.5 8.4 12 8.4H12V1.2Q12 0 13 .9l10.1 9.8c1.2 1.1 1.2 1.3 0 2.6L13 23.1Q12 24 12 22.8v-6.3Z"/>',
  bookmark: '<path d="M6 3h12v18l-6-4-6 4z"/>',
  volume: '<path d="m11 5-6 4H2v6h3l6 4zM15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14"/>',
  mute: '<path d="m11 5-6 4H2v6h3l6 4zM16 9l5 6M21 9l-5 6"/>',
  search: '<circle cx="10.5" cy="10.5" r="7.5"/><path d="m16 16 5 5"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  user: '<circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  users: '<circle cx="9" cy="8" r="3"/><path d="M3 21v-1a6 6 0 0 1 12 0v1M16 5.5a3 3 0 0 1 0 5.8M18 14a5 5 0 0 1 3 4.6V21"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  back: '<path d="m12 5-7 7 7 7M5 12h15"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  more: '<circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 3 5.2 2 2 0 0 1 5 3h3l2 5-2 2a16 16 0 0 0 6 6l2-2z"/>',
  video: '<rect x="2" y="5" width="14" height="14" rx="2"/><path d="m16 9 6-4v14l-6-4"/>',
  mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/>',
  smile: '<circle cx="12" cy="12" r="10"/><path d="M8 14s1 3 4 3 4-3 4-3M8 8h.01M16 8h.01"/>',
  send: '<path d="m22 2-7 20-4-9-9-4zM22 2 11 13"/>',
  repost: '<path d="m17 2 4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="m7 14-4 4 4 4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z"/>',
  activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  timeCircle: '<rect x="9" y="1" width="6" height="3.3" rx="1.1"/><path d="M7.9 6.1a8.8 8.8 0 0 0-3.7 13.5M8.3 21.9a8.8 8.8 0 0 0 12.1-11.5"/><path d="m4.7 23 3.3-8.2.8 2.5.5-5.2 1.8 2 1-4.8.9 1.2c2.4-4 5.2-5.7 9-5.9.5 2.5-.9 5.7-2.8 7.5L17 12l1.4 1.2-4.8 2.8-2-.1.5 1.6-3.5 1.9Z"/><path d="M4.7 23 19.6 7.4"/>',
  edit: '<path d="m16 3 5 5-12 12-6 1 1-6zM14 5l5 5"/>',
  settings: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  play: '<path d="m8 4 12 8-12 8z"/>',
  camera: '<path d="M3 7h4l2-3h6l2 3h4v14H3z"/><circle cx="12" cy="13" r="4"/>',
  image: '<rect x="3" y="5" width="13" height="15" rx="2"/><path d="M7 5V3h14v14h-5"/><circle cx="9" cy="10" r="1.2"/><path d="m4 16 4-4 3 3 2-2 3 3"/>',
  flip: '<path d="M3 10a9 9 0 0 1 16-5l2 2M21 3v4h-4M21 14a9 9 0 0 1-16 5l-2-2M3 21v-4h4"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  lock: '<rect x="4" y="10" width="16" height="12" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4"/>',
  location: '<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>'
};

export function icon(name, filled = false, strokeWidth = 1.8) {
  return `<svg viewBox="0 0 24 24" class="navic" aria-hidden="true" focusable="false" fill="${filled ? "currentColor" : "none"}" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${paths[name] || paths.more}</svg>`;
}

export const icons = Object.fromEntries(Object.keys(paths).map(name => [name, icon(name)]));
icons.heartOn = icon("heart", true);
icons.bookmarkOn = icon("bookmark", true);
icons.commentFilled = '<svg viewBox="0 0 24 24" class="navic" aria-hidden="true" focusable="false" fill="currentColor" stroke="none"><path fill-rule="evenodd" d="M12 2.5C6.477 2.5 2 6.748 2 12c0 3.05 1.51 5.73 3.86 7.34L5 22l4.52-1.9c.79.2 1.62.3 2.48.3 5.523 0 10-4.248 10-9.5S17.523 2.5 12 2.5ZM9.5 12a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm4 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm4 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z"/></svg>';
icons.repost = icon("repost", false, 2.6);
icons.share = icon("share", true, 0);
