const paths = {
  chevronRight: '<path d="m9 18 6-6-6-6"/>',
  up: '<path d="m6 14 6-6 6 6"/>',
  down: '<path d="m6 10 6 6 6-6"/>',
  home: '<path d="M3.5 10.5 11 3.8a1.5 1.5 0 0 1 2 0l7.5 6.7M5.5 9.4v10.1h5v-6h4v6h4V9.4"/>',
  heart: '<path d="M20.8 4.6a5.6 5.6 0 0 0-7.9 0L12 5.5l-.9-.9a5.6 5.6 0 0 0-7.9 7.9l.9.9L12 21l7.9-7.6.9-.9a5.6 5.6 0 0 0 0-7.9Z"/>',
  comment: '<path d="M20.5 11.5a8.5 8.5 0 0 1-8.5 8.5 9 9 0 0 1-4-.9L3 21l1.9-4.5a8.5 8.5 0 1 1 15.6-5Z"/>',
  messages: '<path class="conversation-front" d="M4 8.5h10a2 2 0 0 1 2 2v10l-3.5-2H4a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2Z"/><path fill="none" d="M6 5.5h11a2 2 0 0 1 2 2v8M9 2.5h11a2 2 0 0 1 2 2v8"/>',
  messagePlus: '<path d="M4 8.5h10a2 2 0 0 1 2 2v10l-3.5-2H4a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2Z"/><path d="M6 5.5h11a2 2 0 0 1 2 2v8M9 2.5h11a2 2 0 0 1 2 2v8M9 11v5m-2.5-2.5h5"/>',
  share: '<path d="m14 4.5 7 6.8-7 6.8v-4.2c-4.4 0-7.9 1.7-10.5 5.6C4.2 12.8 7.8 9 14 9V4.5Z"/>',
  bookmark: '<path d="M6 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v17l-6-4-6 4z"/>',
  mediaHeart: '<path transform="matrix(.3 0 0 .3 -10.8 -.45)" vector-effect="non-scaling-stroke" d="M76 22C64 8 47 18 47 36c0 17 20 31 30 38 12-8 30-21 30-38 0-18-18-28-31-14L76 22Z"/>',
  mediaComment: '<path transform="matrix(.3 0 0 .3 -11.25 -46.8)" vector-effect="non-scaling-stroke" d="M77 164c-16 0-29 12-29 28 0 12 6 20 17 25l-3 12 16-12c17 0 29-12 29-27 0-15-13-26-30-26Z"/>',
  mediaBookmark: '<path transform="matrix(.35 0 0 .35 -14.6 -106.825)" vector-effect="non-scaling-stroke" d="M61 312h30c5 0 8 3 8 8v47l-23-15-23 15v-47c0-5 3-8 8-8Z"/>',
  archive: '<rect x="5" y="4" width="14" height="12" rx="2"/><path d="M3 10v8a2 2 0 0 0 2 2h14M9 8h6M9 11.5h4"/>',
  volume: '<path d="m11 5-6 4H2v6h3l6 4zM15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14"/>',
  mute: '<path d="m11 5-6 4H2v6h3l6 4zM16 9l5 6M21 9l-5 6"/>',
  soundOff: '<path d="m11 5-6 4H2v6h3l6 4zM22 9l-6 6"/>',
  search: '<circle cx="10.5" cy="10.5" r="7.5"/><path d="m16 16 5 5"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  user: '<circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  users: '<circle cx="9" cy="8" r="3"/><path d="M3 21v-1a6 6 0 0 1 12 0v1M16 5.5a3 3 0 0 1 0 5.8M18 14a5 5 0 0 1 3 4.6V21"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  back: '<path d="m12 5-7 7 7 7M5 12h15"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  more: '<circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 3 5.2 2 2 0 0 1 5 3h3l2 5-2 2a16 16 0 0 0 6 6l2-2z"/>',
  video: '<rect x="3" y="4.5" width="18" height="15" rx="3"/><path d="m10 8.5 6 3.5-6 3.5z"/>',
  mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  smile: '<circle cx="12" cy="12" r="10"/><path d="M8 14s1 3 4 3 4-3 4-3M8 8h.01M16 8h.01"/>',
  send: '<path d="m22 2-7 20-4-9-9-4zM22 2 11 13"/>',
  sendUp: '<path d="M12 19V5m-7 7 7-7 7 7"/>',
  repost: '<path d="m17 3 4 4-4 4M3 7h18M7 21l-4-4 4-4m14 4H3"/>',
  remix: '<path d="M16 3h5v5"/><path d="M4 20 21 3"/><path d="M21 16v5h-5"/><path d="m15 15 6 6"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z"/>',
  activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  timeCircle: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/>',
  edit: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  settings: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  tune: '<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="7" cy="18" r="2"/>',
  gear: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.09a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.08a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.08a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  grid: '<rect x="3.5" y="3.5" width="7" height="6" rx="1.5"/><rect x="14" y="3.5" width="6.5" height="8" rx="1.5"/><rect x="3.5" y="13" width="7" height="7.5" rx="1.5"/><rect x="14" y="15" width="6.5" height="5.5" rx="1.5"/>',
  play: '<path d="m8 4 12 8-12 8z"/>',
  camera: '<rect x="3" y="6.5" width="18" height="13" rx="3"/><path d="M8 6.5 9.5 4h5L16 6.5"/><circle cx="12" cy="13" r="3.5"/><path d="M17.5 9.5h.1"/>',
  template: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h3M8 16h8M14 12h2"/>',
  quote: '<path d="M4 4h16v16H4z"/><path d="M7 9h3v4H7zM14 9h3v4h-3zM8 16h8"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14"/>',
  image: '<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><path d="m4 15 5-4 4 3 3-2 4 4"/><circle cx="15" cy="9" r="1.2"/>',
  flip: '<path d="M3 10a9 9 0 0 1 16-5l2 2M21 3v4h-4M21 14a9 9 0 0 1-16 5l-2-2M3 21v-4h4"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  lock: '<rect x="4" y="10" width="16" height="12" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4"/>',
  logout: '<path d="M14 4.5V4a1.5 1.5 0 0 0-1.5-1.5h-7A1.5 1.5 0 0 0 4 4v16a1.5 1.5 0 0 0 1.5 1.5h7A1.5 1.5 0 0 0 14 20v-.5"/><path d="M9.5 12H21m-3.5-3.5L21 12l-3.5 3.5"/>',
  flag: '<path d="M5 21V4m0 1c5-4 9 4 14 0v11c-5 4-9-4-14 0"/>',
  location: '<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  music: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.6-4.5L4 8M4 3v5h5M4 13a8 8 0 0 0 14.6 4.5L20 16M20 21v-5h-5"/>',
  shield: '<path d="M12 3 4 6v6c0 5 3.4 8 8 9 4.6-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/>',
  document: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
  community: '<circle cx="12" cy="6.5" r="2.5"/><circle cx="5.5" cy="16" r="2.5"/><circle cx="18.5" cy="16" r="2.5"/><path d="M10 8.5 7 13.8M14 8.5l3 5.3M8.3 16.5h7.4"/>',
  group: '<circle cx="8" cy="9" r="3"/><circle cx="16.5" cy="7.5" r="2.5"/><path d="M2.5 20a5.5 5.5 0 0 1 11 0M14 12.6a5 5 0 0 1 7.5 4.4"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.6M12 16.8v.01"/>',
  official: '<path d="M12 2.8 14.3 4.6l2.9-.3.9 2.8 2.5 1.5-.9 2.8.9 2.8-2.5 1.5-.9 2.8-2.9-.3L12 21.2 9.7 19.4l-2.9.3-.9-2.8-2.5-1.5.9-2.8-.9-2.8 2.5-1.5.9-2.8 2.9.3Z"/><path d="m8.8 12.2 2.2 2.2 4.3-4.6"/>',
  privacyCenter: '<path d="M12 2.8 4.5 5.8v5.6c0 4.7 3.1 8 7.5 9.8 4.4-1.8 7.5-5.1 7.5-9.8V5.8Z"/><circle cx="12" cy="10.5" r="2"/><path d="M12 12.5v3"/>',
  accountPrivacy: '<circle cx="9.5" cy="8" r="3.5"/><path d="M3 20a6.5 6.5 0 0 1 9.5-5.8"/><rect x="14" y="15" width="7" height="5.5" rx="1.2"/><path d="M15.8 15v-1.5a1.7 1.7 0 0 1 3.4 0V15"/>',
  blocked: '<circle cx="12" cy="12" r="8.5"/><path d="m6 6 12 12"/>',
  chatPrivacy: '<path d="M5.5 4.5h13a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2H11l-4.5 3v-3h-1a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2Z"/><rect x="9" y="10" width="6" height="4" rx="1"/><path d="M10.3 10V9a1.7 1.7 0 0 1 3.4 0v1"/>',
  about: '<rect x="4" y="3" width="16" height="18" rx="2.5"/><path d="M12 10.5v6M12 7.3v.01M8 18.5h8"/>',
  campaigns: '<path d="M4 9.5v5h3l8 4.5V5L7 9.5Z"/><path d="M7 14.5 8.5 20h2.5l-1-5M18.5 9a4 4 0 0 1 0 6"/>',
  closeFriends: '<circle cx="12" cy="12" r="9"/><path d="m12 7.2 1.4 2.9 3.2.4-2.3 2.2.6 3.1-2.9-1.5-2.9 1.5.6-3.1-2.3-2.2 3.2-.4Z"/>',
  clearData: '<path d="M3.5 6.5h17M9 6.5V4.2h6v2.3M6 6.5l.9 13a1.5 1.5 0 0 0 1.5 1.3h7.2a1.5 1.5 0 0 0 1.5-1.3l.9-13"/><path d="M10 11v6M14 11v6"/>',
  save: '<path d="M6 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v17l-6-4-6 4z"/>',
  smilePlus: '<circle cx="10" cy="12" r="8"/><path d="M6.5 13.5s1.2 2 3.5 2 3.5-2 3.5-2M7.5 9h.01M12.5 9h.01M19 4v6M16 7h6"/>'
};
export const iconPaths = paths;

export function icon(name, filled = false, strokeWidth = 1.75) {
  const key=Object.prototype.hasOwnProperty.call(paths,name)?name:"more";
  return `<svg viewBox="0 0 24 24" class="navic" data-icon="${key}" aria-hidden="true" focusable="false" fill="${filled ? "currentColor" : "none"}" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${paths[key]}</svg>`;
}

export const icons = Object.fromEntries(Object.keys(paths).map(name => [name, icon(name)]));
icons.heartOn = icon("heart", true);
icons.bookmarkOn = icon("bookmark", true);
icons.mediaHeartOn = icon("mediaHeart", true);
icons.mediaBookmarkOn = icon("mediaBookmark", true);
icons.commentFilled = icon("comment");
icons.repost = icon("repost");
icons.share = icon("share");
export const messageIcons={...icons,comment:icons.messages};
