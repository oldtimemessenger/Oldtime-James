// Original flat editorial mini-scenes for tips, help and Privacy Center.
// Solid royal blue / gray / white / burgundy shapes with restrained outline accents.
// Self-contained (inline fills), no logos, no trademarks, no sparkle decoration.
const C = {
  bg: "#eef1f7", blob: "#dfe5f1", blue: "#1456d9", navy: "#172a6b", sky: "#9fb4ec",
  white: "#fbfcfe", gray: "#c3c9d4", ink: "#17191c", wine: "#8e1b24", rose: "#c45a74",
  skinA: "#e9b896", skinB: "#9b6547", skinC: "#c98a62", hairA: "#2a1f1d", hairB: "#5a3a2a",
};
const line = `fill="none" stroke="${C.ink}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"`;

const frame = inner => `<svg class="tip-illo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180" role="presentation" aria-hidden="true" focusable="false">
  ${inner}</svg>`;

// Simplified figure: torso shape, head, hair cap.
const person = ({ x, y, s = 1, shirt = C.blue, skin = C.skinA, hair = C.hairA, flip = false }) =>
  `<g transform="translate(${x} ${y}) scale(${flip ? -s : s} ${s})">
    <path d="M-26 40c0-26 10-42 26-42s26 16 26 42z" fill="${shirt}"/>
    <rect x="-5" y="-10" width="10" height="12" rx="3" fill="${skin}"/>
    <circle cx="0" cy="-20" r="13" fill="${skin}"/>
    <path d="M-13 -22a13 13 0 0 1 26 0c-6-5-13-6-26 0z" fill="${hair}"/>
  </g>`;
const phone = (x, y, w = 58, h = 100, screen = C.white) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${C.navy}"/>
   <rect x="${x + 5}" y="${y + 9}" width="${w - 10}" height="${h - 18}" rx="5" fill="${screen}"/>`;
const hand = (x, y, skin = C.skinA, r = 0) =>
  `<g transform="translate(${x} ${y}) rotate(${r})"><rect x="-9" y="-6" width="18" height="22" rx="8" fill="${skin}"/><rect x="-13" y="14" width="26" height="30" rx="4" fill="${C.wine}"/></g>`;
const bubble = (x, y, w, fill, tail = "left") =>
  `<path d="M${x + 10} ${y}h${w - 20}a10 10 0 0 1 10 10v12a10 10 0 0 1-10 10h-${tail === "left" ? w - 34 : 14}l-10 9v-9h-${tail === "left" ? 4 : w - 44}a10 10 0 0 1-10-10v-12a10 10 0 0 1 10-10z" fill="${fill}"/>`;

const SCENES = {
  welcome: () => frame(`
    ${phone(132, 24, 64, 120)}
    <rect x="143" y="43" width="42" height="36" rx="7" fill="${C.sky}"/>
    <path d="M145 74l13-16 10 10 8-8 9 14z" fill="${C.blue}"/>
    <rect x="144" y="91" width="39" height="5" rx="2" fill="${C.gray}"/>
    <rect x="144" y="104" width="27" height="5" rx="2" fill="${C.gray}"/>
    ${person({x:86,y:119,s:.9,shirt:C.wine,skin:C.skinB})}
    ${person({x:239,y:118,s:.9,shirt:C.blue,skin:C.skinA})}`),
  cover: () => frame(`
    <rect x="66" y="32" width="188" height="119" rx="12" fill="${C.gray}"/>
    <rect x="72" y="38" width="176" height="107" rx="8" fill="${C.white}"/>
    <path d="M72 46a8 8 0 0 1 8-8h160a8 8 0 0 1 8 8v42H72z" fill="${C.blue}"/>
    <path d="M75 86l42-37 37 37 30-24 60 24" fill="${C.sky}"/>
    <circle cx="114" cy="98" r="23" fill="${C.white}"/>
    ${person({x:114,y:112,s:.53,shirt:C.wine,skin:C.skinC})}
    <rect x="150" y="103" width="74" height="5" rx="2" fill="${C.navy}"/>
    <rect x="150" y="116" width="48" height="4" rx="2" fill="${C.gray}"/>`),
  note: () => frame(`
    <path d="M87 32h130v116H87z" fill="${C.blue}"/>
    <path d="M98 25h130v116H98z" fill="${C.white}"/>
    <rect x="113" y="47" width="84" height="6" rx="3" fill="${C.navy}"/>
    <rect x="113" y="65" width="94" height="5" rx="2" fill="${C.gray}"/>
    <rect x="113" y="82" width="76" height="5" rx="2" fill="${C.gray}"/>
    <g transform="translate(224 90) rotate(32)"><rect x="-6" y="-46" width="12" height="77" rx="4" fill="${C.wine}"/><path d="M-6 31h12L0 46z" fill="${C.skinA}"/></g>
    ${hand(93,119,C.skinB,-14)}`),
  saved: () => frame(`
    <rect x="75" y="36" width="120" height="103" rx="9" fill="${C.sky}"/>
    <rect x="91" y="47" width="120" height="103" rx="9" fill="${C.gray}"/>
    <rect x="108" y="58" width="120" height="103" rx="9" fill="${C.white}"/>
    <rect x="120" y="73" width="96" height="44" rx="6" fill="${C.blue}"/>
    <path d="M177 58h25v45l-13-9-12 9z" fill="${C.wine}"/>
    <rect x="120" y="130" width="75" height="5" rx="2" fill="${C.gray}"/>
    <rect x="120" y="141" width="49" height="4" rx="2" fill="${C.gray}"/>`),
  interests: () => frame(`
    <rect x="67" y="40" width="55" height="43" rx="13" fill="${C.blue}"/>
    <rect x="132" y="40" width="55" height="43" rx="13" fill="${C.sky}"/>
    <rect x="197" y="40" width="55" height="43" rx="13" fill="${C.wine}"/>
    <rect x="67" y="94" width="55" height="43" rx="13" fill="${C.gray}"/>
    <rect x="132" y="94" width="55" height="43" rx="13" fill="${C.wine}"/>
    <rect x="197" y="94" width="55" height="43" rx="13" fill="${C.blue}"/>
    <path d="M94 52v17m0-17 10-3v15" stroke="${C.white}" stroke-width="4" fill="none"/>
    <circle cx="91" cy="70" r="5" fill="${C.white}"/><circle cx="101" cy="65" r="5" fill="${C.white}"/>
    <path d="M143 72l12-19 17 19zM205 124l12-17 12 17z" fill="${C.white}"/>
    <circle cx="224" cy="61" r="10" fill="${C.white}"/>
    <path d="M82 116h25m-12-12v24M147 116h25" stroke="${C.white}" stroke-width="4" stroke-linecap="round"/>`),
  safety: () => frame(`
    <path d="M160 26l55 19v45c0 31-24 53-55 68-31-15-55-37-55-68V45z" fill="${C.blue}"/>
    <path d="M160 39l42 15v36c0 23-17 41-42 55z" fill="${C.sky}"/>
    <path d="M133 86l18 18 34-35" stroke="${C.white}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    ${person({x:74,y:130,s:.7,shirt:C.wine,skin:C.skinC})}`),
  blast: () => frame(`
    <rect x="72" y="64" width="177" height="88" rx="9" fill="${C.blue}"/>
    <path d="M75 68l86-49 85 49-86 52z" fill="${C.sky}"/>
    <rect x="113" y="37" width="96" height="72" rx="8" fill="${C.white}"/>
    <circle cx="143" cy="61" r="10" fill="${C.skinB}"/><path d="M128 89q0-18 15-18t15 18z" fill="${C.wine}"/>
    <circle cx="180" cy="61" r="10" fill="${C.skinA}"/><path d="M165 89q0-18 15-18t15 18z" fill="${C.blue}"/>
    <path d="M74 75l86 50 86-50v69a8 8 0 0 1-8 8H82a8 8 0 0 1-8-8z" fill="${C.blue}"/>`),
  privacy: () => frame(`
    ${phone(130, 32)}
    <rect x="145" y="64" width="28" height="24" rx="5" fill="${C.blue}"/>
    <path d="M151 64v-7a8 8 0 0 1 16 0v7" ${line}/>
    <circle cx="159" cy="75" r="3" fill="${C.white}"/>
    <rect x="141" y="98" width="36" height="5" rx="2.5" fill="${C.gray}"/>
    ${hand(184, 108, C.skinB, -14)}
    ${person({ x: 76, y: 112, shirt: C.wine, skin: C.skinC, hair: C.hairB })}
    <rect x="222" y="54" width="54" height="34" rx="8" fill="${C.white}"/>
    <path d="M232 66h34M232 76h22" ${line}/>`),
  friends: () => frame(`
    ${person({ x: 104, y: 110, shirt: C.wine, skin: C.skinB })}
    ${person({ x: 160, y: 100, s: 1.15, shirt: C.blue, skin: C.skinA, hair: C.hairB })}
    ${person({ x: 216, y: 110, shirt: C.gray, skin: C.skinC })}
    <rect x="136" y="34" width="48" height="26" rx="13" fill="${C.navy}"/>
    <path d="M150 47l6 6 12-12" fill="none" stroke="${C.white}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`),
  chat: () => frame(`
    ${bubble(62, 38, 110, C.blue)}
    <rect x="76" y="50" width="70" height="5" rx="2.5" fill="${C.white}"/>
    ${bubble(150, 82, 110, C.white, "right")}
    <rect x="164" y="94" width="58" height="5" rx="2.5" fill="${C.gray}"/>
    ${person({ x: 66, y: 126, s: .8, shirt: C.wine, skin: C.skinC })}
    ${person({ x: 262, y: 128, s: .8, shirt: C.navy, skin: C.skinA, flip: true })}`),
  discover: () => frame(`
    <rect x="70" y="34" width="50" height="66" rx="8" fill="${C.blue}"/>
    <circle cx="95" cy="58" r="10" fill="${C.sky}"/>
    <rect x="128" y="34" width="50" height="40" rx="8" fill="${C.wine}"/>
    <rect x="128" y="82" width="50" height="56" rx="8" fill="${C.white}"/>
    <path d="M136 122l12-14 10 10 6-6 8 10" ${line}/>
    <rect x="70" y="108" width="50" height="30" rx="8" fill="${C.gray}"/>
    <circle cx="228" cy="78" r="26" fill="${C.white}"/>
    <circle cx="228" cy="78" r="26" ${line}/>
    <rect x="246" y="98" width="12" height="32" rx="6" transform="rotate(-40 252 114)" fill="${C.navy}"/>`),
  create: () => frame(`
    <rect x="88" y="58" width="96" height="72" rx="10" fill="${C.gray}"/>
    <rect x="104" y="44" width="100" height="74" rx="10" fill="${C.blue}"/>
    <path d="M138 44l7-10h28l7 10z" fill="${C.navy}"/>
    <circle cx="154" cy="81" r="20" fill="${C.white}"/>
    <circle cx="154" cy="81" r="11" fill="${C.wine}"/>
    ${hand(220, 100, C.skinC, 10)}
    <rect x="228" y="56" width="40" height="22" rx="11" fill="${C.white}"/>
    <path d="M240 67h16" ${line}/>`),
  notifications: () => frame(`
    ${phone(130, 32)}
    <path d="M145 86c0-18 6-28 14-28s14 10 14 28l5 6h-38z" fill="${C.blue}"/>
    <circle cx="159" cy="98" r="5" fill="${C.wine}"/>
    <rect x="68" y="56" width="50" height="16" rx="8" fill="${C.white}"/>
    <rect x="76" y="62" width="30" height="4" rx="2" fill="${C.gray}"/>
    <rect x="200" y="84" width="54" height="16" rx="8" fill="${C.wine}"/>
    <rect x="208" y="90" width="34" height="4" rx="2" fill="${C.white}"/>
    ${hand(184, 112, C.skinA, -12)}`),
  community: () => frame(`
    <path d="M74 136V82l42-28 42 28v54z" fill="${C.white}"/>
    <path d="M70 84l46-32 46 32" ${line}/>
    <rect x="104" y="104" width="24" height="32" rx="3" fill="${C.wine}"/>
    <path d="M162 136V92l42-26 42 26v44z" fill="${C.blue}"/>
    <rect x="188" y="100" width="14" height="14" rx="2" fill="${C.sky}"/>
    <rect x="208" y="100" width="14" height="14" rx="2" fill="${C.sky}"/>
    ${person({ x: 160, y: 124, s: .62, shirt: C.navy, skin: C.skinB })}`),
  insights: () => frame(`
    <rect x="70" y="36" width="180" height="104" rx="12" fill="${C.white}"/>
    <rect x="92" y="96" width="22" height="30" rx="4" fill="${C.gray}"/>
    <rect x="124" y="78" width="22" height="48" rx="4" fill="${C.sky}"/>
    <rect x="156" y="60" width="22" height="66" rx="4" fill="${C.blue}"/>
    <rect x="188" y="84" width="22" height="42" rx="4" fill="${C.wine}"/>
    <path d="M90 126h140" ${line}/>
    ${person({ x: 268, y: 130, s: .7, shirt: C.navy, skin: C.skinC, flip: true })}`),
};
// Distinct education artwork, not account avatars or interchangeable decoration.
Object.assign(SCENES, {
  information: () => frame(`<rect x="100" y="28" width="124" height="122" rx="12" fill="${C.white}" stroke="${C.ink}" stroke-width="2"/><circle cx="136" cy="65" r="15" fill="${C.sky}"/><path d="M116 96q20-28 40 0" fill="${C.blue}"/><path d="M170 59h34m-34 15h25m-88 43h96m-96 14h71" ${line}/><path d="M217 107l25 25-25 25-25-25z" fill="${C.wine}"/>`),
  messaging: () => frame(`<path d="M65 43h132v73h-76l-30 23v-23H65z" fill="${C.blue}"/><path d="M146 76h108v63h-21v19l-26-19h-61z" fill="${C.white}" stroke="${C.ink}" stroke-width="2"/><circle cx="179" cy="107" r="5" fill="${C.wine}"/><circle cx="200" cy="107" r="5" fill="${C.wine}"/><circle cx="221" cy="107" r="5" fill="${C.wine}"/>`),
  audience: () => frame(`<circle cx="159" cy="65" r="20" fill="${C.skinB}"/><path d="M122 139v-26q0-25 37-25t37 25v26z" fill="${C.blue}"/><circle cx="88" cy="91" r="15" fill="${C.skinA}"/><path d="M62 139v-18q0-18 26-18t26 18v18z" fill="${C.wine}"/><circle cx="230" cy="91" r="15" fill="${C.skinC}"/><path d="M204 139v-18q0-18 26-18t26 18v18z" fill="${C.gray}"/><path d="M123 45q36-28 72 0" ${line}/>`),
  location: () => frame(`<path d="M62 111l65-20 61 20 65-20v52l-65 20-61-20-65 20z" fill="${C.sky}"/><path d="M127 91v52m61-32v52" stroke="${C.white}" stroke-width="3"/><path d="M159 24c-24 0-39 17-39 39 0 25 39 63 39 63s39-38 39-63c0-22-15-39-39-39z" fill="${C.blue}"/><circle cx="159" cy="63" r="14" fill="${C.white}"/>`),
  membership: () => frame(`<path d="M119 101l-13 57 35-13 20 24 12-59m12-9 26 57-35-13-20 24-12-59" fill="${C.wine}"/><path d="M159 24l17 12 21 2 7 20 13 17-9 19-2 21-20 7-17 13-19-9-21-2-7-20-13-17 9-19 2-21 20-7z" fill="${C.blue}"/><path d="M135 78l17 17 34-36" stroke="${C.white}" stroke-width="9" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`),
  analytics: () => frame(`<circle cx="116" cy="88" r="53" fill="${C.sky}"/><path d="M116 88V35a53 53 0 0 1 51 68z" fill="${C.blue}"/><path d="M116 88l51 15a53 53 0 0 1-78 31z" fill="${C.wine}"/><rect x="191" y="103" width="18" height="38" rx="3" fill="${C.gray}"/><rect x="216" y="77" width="18" height="64" rx="3" fill="${C.blue}"/><rect x="241" y="48" width="18" height="93" rx="3" fill="${C.navy}"/>`),
});
const ALIASES = { safety: "privacy", information: "insights", audience: "privacy", data: "privacy", "chat-privacy": "chat", messages: "chat",
  messaging: "chat", conversation: "chat", connect: "friends", neighbors: "friends", lineup: "friends", blocking: "friends",
  saved: "discover", interests: "discover", places: "discover", location: "discover", studio: "create", cover: "create",
  welcome: "create", note: "chat", blast: "community", communities: "community", celebration: "create",
  membership: "insights", creator: "insights" };

export function tipIllustrationKey(hint = "") {
  const h = String(hint).toLowerCase();
  const exact = h.split("/").pop().replace(/\.(webp|png|svg)$/, "");
  if (SCENES[exact]) return exact;
  if (ALIASES[exact]) return ALIASES[exact];
  for (const key of Object.keys(SCENES)) if (h.includes(key)) return key;
  for (const [alias, key] of Object.entries(ALIASES)) if (h.includes(alias)) return key;
  if (/lock|private|block/.test(h)) return "privacy";
  if (/follow|friend|people/.test(h)) return "friends";
  if (/search|explore|topic/.test(h)) return "discover";
  if (/analytic|dashboard|views|numbers/.test(h)) return "insights";
  return "create";
}

const cache = new Map();
export function tipIllustration(hint = "") {
  const key = tipIllustrationKey(hint);
  if (!cache.has(key)) cache.set(key, SCENES[key]());
  return cache.get(key);
}
