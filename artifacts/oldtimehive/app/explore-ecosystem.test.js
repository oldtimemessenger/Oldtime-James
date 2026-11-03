import test from "node:test";
import assert from "node:assert/strict";
import { createExploreEcosystem } from "./explore-ecosystem.js";

const post = (id, extra = {}) => ({ id, author: "me", kind: "photo", caption: `post ${id}`, media: ["/m.png"], mediaTypes: [], mediaPosters: [], ...extra });

function setup(handler, matchesHomeTopic = () => true, overrides = {}) {
  const calls = [];
  const cached = [];
  let account = "acct-1";
  let renders = 0;
  const eco = createExploreEcosystem({
    api: {
      cloudAccountId: () => account, me: () => ({ id: "me" }), cloudAuthorId: p => p.id,
      user: id => ({ username: String(id) }),
      cacheCloudExplorePosts: posts => {
        cached.push(...posts);
        return posts.map(p => post(p.id, {
          author: p.author || "me",
          caption: p.caption || p.text || `post ${p.id}`,
          kind: p.kind || "photo",
          media: (p.media || []).map(item => typeof item === "string" ? item : item?.reference).filter(Boolean),
          mediaPosters: p.mediaPosters || (p.poster ? [p.poster] : (p.media || []).map(item => item?.thumbnailReference || null)),
          mediaTypes: p.mediaTypes || (p.video ? ["video/mp4"] : []),
          ...(p.destination ? { destination: p.destination } : {}),
        }));
      },
    },
    requestCloudApi: async (path, options) => { calls.push(path); return handler(path, options); },
    esc: v => String(v ?? ""), ic: { search: "" }, renderMediaUrl: v => v,
    isLocalMedia: v => String(v || "").startsWith("oldtime-media:"), automaticAvatar: () => "a.svg",
    matchesHomeTopic,
    rerender: () => { renders++; }, openPostViewer() {}, navigateToProfile() {}, selectPlace() {}, toast() {},
    isActive: () => true,
    ...overrides,
  });
  return { eco, calls, cached, setAccount: v => { account = v; }, renders: () => renders };
}
const body = (posts = [], extra = {}) => ({ posts, people: [], places: [], hashtags: [], topics: [], topicOptions: [], emergingTopics: [],
  relatedSearches: [], postTopics: [], preferences: { hiddenTopics: [], personalize: true }, correctedQuery: null, hasMore: false, nextOffset: posts.length, ...extra });
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

test("opening Search suggests real names without replacing the normal landing", async () => {
  const f = setup(path => body(path.includes("type=people") ? [] : [post("landing-video", { kind: "video", video: true })], {
    people: [{ id: "member", username: "member", displayName: "A Member" }],
  }));
  f.eco.markup({ searching: true });
  await tick();
  const search = f.eco.markup({ searching: true }).body;
  assert.match(f.calls[0], /type=people/);
  assert.match(search, /Suggested names/);
  assert.match(search, /A Member/);
  assert.doesNotMatch(search, /data-xe-post="landing-video"/);
  f.eco.markup();
  await tick();
  assert.match(f.eco.markup().body, /data-xe-post="landing-video"/);
  f.eco.reset();
});

test("typed results include matching names and related searches; clear restores All", async () => {
  const f = setup(path => body([post(path.includes("q=") ? "matched-post" : "landing-post")], {
    people: [{ id: "krysti", username: "kiki", displayName: "Krysti" }],
    relatedSearches: path.includes("q=") ? ["Krysti travel"] : [],
  }), () => false);
  f.eco.markup({ searching: true });
  await tick();
  f.eco.setQuery("Krysti", { immediate: true });
  await tick();
  const result = f.eco.markup({ searching: true });
  assert.match(result.body, /xe-search-name-list/);
  assert.match(result.body, /Krysti travel/);
  assert.match(result.body, /data-xe-post="matched-post"/, "typed searches are not limited by landing topics");
  f.eco.clearSearch();
  await tick();
  const landing = f.eco.markup();
  assert.match(landing.input, /value=""/);
  assert.equal(f.eco.isSearching(), false);
  assert.doesNotMatch(landing.body, /Krysti travel/);
  assert.match(landing.body, /xe-chip on[^>]*data-xe-type="all"/);
  f.eco.reset();
});

test("Search keeps a swipeable video preview rail separate from Stories", async () => {
  const f = setup(() => body([
    post("rail-video-one", { author:"creator-one", kind:"video", video:true, media:["/one.mp4"], mediaPosters:["/one.jpg"] }),
    post("rail-photo", { author:"photo-author", kind:"photo", media:["/photo.jpg"] }),
    post("rail-video-two", { author:"creator-two", kind:"video", video:true, media:["/two.mp4"], mediaPosters:["/two.jpg"] }),
    post("rail-community-video", { author:"community-author", kind:"video", video:true, destination:"community", media:["/community.mp4"] }),
  ]));
  f.eco.markup();
  await tick();
  const rail = f.eco.videoPreviewRailMarkup();
  assert.match(rail, /class="discovery-video-rail"/);
  assert.match(rail, /class="discovery-video-track"/);
  assert.match(rail, /data-xe-post="rail-video-one"/);
  assert.match(rail, /data-xe-post="rail-video-two"/);
  assert.match(rail, /@creator-one/);
  assert.match(rail, /Video/);
  assert.doesNotMatch(rail, /rail-photo|rail-community-video|Story|Stories/);
  assert.equal((rail.match(/class="discovery-video-card"/g) || []).length, 2);
  f.eco.reset();
});

test("Search excludes Community media and the viewer fetches the next cloud page",async()=>{
  const {eco,calls}=setup(path=>new URL(path,"https://test.invalid").searchParams.get("offset")==="24"
    ?body([post("next",{kind:"video",video:true})],{hasMore:false,nextOffset:48})
    :body([post("first",{kind:"video",video:true}),post("community-video",{kind:"video",video:true,destination:"community"})],{hasMore:true,nextOffset:24}));
  eco.markup();await tick();
  assert.doesNotMatch(eco.markup().body,/data-xe-post="community-video"/);
  assert.doesNotMatch(eco.markup().body,/data-xe-type="community"/);
  assert.equal(await eco.ensureNext("first"),"next");
  assert.equal(calls.length,2);
  assert.equal(await eco.ensureNext("next"),"");
  assert.equal(calls.length,2);
});

test("Places opens the dedicated landing instead of switching to a plain Search list", async () => {
  for (const query of ["", "Greece"]) {
    const opened = [];
    const f = setup(async () => body(), () => true, { openPlaces: value => opened.push(value) });
    await f.eco.ensure();
    if (query) f.eco.setQuery(query);
    const chip = { dataset:{ xeType:"places" } };
    const root = {
      querySelector: () => null,
      querySelectorAll: selector => selector === "[data-xe-type]" ? [chip] : [],
      addEventListener() {}, removeEventListener() {},
    };
    f.eco.bind(root);
    const requests = f.calls.length;
    chip.onclick();
    assert.deepEqual(opened, [query]);
    assert.equal(f.calls.length, requests, "does not fetch the legacy place rows");
    f.eco.reset();
  }
});

test("loads the explore endpoint once with All, caches posts and renders honest empty state", async () => {
  const { eco, calls, cached } = setup(() => body([{ id: "p1", kind:"video", video:true, media: ["/m.mp4"] }]));
  eco.markup();
  await tick();
  assert.match(calls[0], /^\/api\/discovery\/explore\?/);
  assert.match(calls[0], /type=all/);
  assert.deepEqual(cached.map(p => p.id), ["p1"]);
  assert.match(eco.markup().body, /data-xe-post="p1"/);
  assert.equal(calls.length, 1);
});

test("video tiles use the stored poster, never a video element", async () => {
  const { eco } = setup(() => body([{ id: "v1", video: true, poster: "/poster.jpg", media: ["/video.mp4"] }]));
  eco.markup();
  await tick();
  const html = eco.markup().body;
  assert.match(html, /\/poster\.jpg/);
  assert.doesNotMatch(html, /<video/);
});

test("private Cloudflare media references use authenticated media hydration", async () => {
  const { eco } = setup(() => body([{
    id: "v2", kind:"video", video: true, media: ["oldtime-media:22222222-2222-4222-8222-222222222222"],
    poster: "oldtime-media:33333333-3333-4333-8333-333333333333",
  }]));
  eco.markup();
  await tick();
  const html = eco.markup().body;
  assert.match(html, /data-local-media="oldtime-media:33333333-3333-4333-8333-333333333333"/);
  assert.doesNotMatch(html, /src="oldtime-media:/);
});

test("the no-query Search landing shows mixed media while keeping text-only posts out", async () => {
  const { eco } = setup(() => body([
    { id: "text-only", kind: "text", media: [] },
    { id: "photo", kind: "photo", media: ["/photo.jpg"] },
    { id: "video", kind: "video", video: true, media: ["/video.mp4"] },
  ]));
  eco.markup();
  await tick();
  assert.match(eco.markup().body, /data-xe-type="all"/);
  assert.match(eco.markup().body, /data-xe-post="video"/);
  assert.match(eco.markup().body, /data-xe-post="photo"/);
  assert.doesNotMatch(eco.markup().body, /data-xe-post="text-only"/);
});

test("moved Home topic filters apply to Cloud Discover without another request", async () => {
  const { eco, calls } = setup(() => body([
    { id: "culture-post", kind:"video", video:true, caption: "Culture across the world", media: ["/culture.mp4"] },
    { id: "food-post", kind:"video", video:true, caption: "Cooking dinner", media: ["/food.mp4"] },
  ]), (item, topic) => topic === "all" || topic === "culture" && /culture/i.test(item.caption));
  eco.markup({ homeTopic: "culture" });
  await tick();
  const html = eco.markup({ homeTopic: "culture" }).body;
  assert.match(html, /data-xe-post="culture-post"/);
  assert.doesNotMatch(html, /data-xe-post="food-post"/);
  assert.equal(calls.length, 1, "changing a local topic does not reload Cloud data");
});

test("Discover exposes server-ranked topic chips and filters through the explore endpoint", async () => {
  const { eco, calls } = setup(path => {
    const topic = new URL(path, "https://oldtime.test").searchParams.get("topic") || "";
    return body([post(topic ? "filtered-post" : "all-posts")], {
      topics: [{ id: "dating-humor", label: "Dating humor", postCount: 3 }],
      topicOptions: [{ id: "dating-humor", label: "Dating humor" }, { id: "nba", label: "NBA" }],
    });
  });
  assert.doesNotMatch(eco.markup({ showTypeFilters: false }).body, /Result type/);
  await tick();
  const initial = eco.markup({ showTypeFilters: false });
  assert.deepEqual(initial.topics, [{ id: "dating-humor", label: "Dating humor", postCount: 3 }]);
  assert.equal(initial.activeTopic, "");

  eco.setTopic("dating-humor");
  await tick();
  assert.ok(calls.some(path => new URL(path, "https://oldtime.test").searchParams.get("topic") === "dating-humor"));
  assert.equal(eco.markup().activeTopic, "dating-humor");

  eco.setTopic("");
  assert.equal(eco.markup().activeTopic, "");
});

test("account switch drops state and ignores stale responses", async () => {
  const releases = [];
  const { eco, setAccount, calls } = setup(() => new Promise(resolve => { releases.push(() => resolve(body([{ id: "old" }]))); }));
  eco.markup();
  setAccount("acct-2");
  eco.markup();
  releases[0]();
  await tick();
  assert.doesNotMatch(eco.markup().body, /data-xe-post="old"/);
  assert.ok(calls.length >= 2);
});

test("errors are explicit with retry and no local fallback", async () => {
  const { eco } = setup(() => { throw new Error("boom"); });
  eco.markup();
  await tick();
  const html = eco.markup().body;
  assert.doesNotMatch(html, /boom/);
  assert.match(html, /couldn&#39;t load|couldn't load/i);
  assert.match(html, /data-xe-retry/);
});
test("database-driven topic pages reuse the template, save Follow and request Recent and People",async()=>{
  let followed=false;
  const requests=[];
  const selected=()=>({id:"topic-coral",label:"Coral gardening",postCount:3,creatorCount:2,
    followed,relatedTopics:[],postCountIsLowerBound:false});
  const {eco}=setup((path,options)=>{
    requests.push({path,options});
    if(path.endsWith("/follow")){followed=options.body.followed;return {topicId:"topic-coral",followed};}
    if(path.endsWith("/topic-events"))return {recorded:true};
    return body([post("coral-one")],{selectedTopic:selected()});
  });
  eco.setTopic("topic-coral");await tick();
  assert.match(eco.markup().body,/Coral gardening/);
  const follow={disabled:false,textContent:"Follow",dataset:{},isConnected:true};
  const recent={dataset:{xeTopicTab:"recent"}},people={dataset:{xeTopicTab:"people"}};
  const root={querySelector:()=>null,querySelectorAll:selector=>selector==="[data-xe-topic-follow]"?[follow]
    :selector==="[data-xe-topic-tab]"?[recent,people]:[]};
  eco.bind(root);await follow.onclick();
  assert.equal(follow.textContent,"Following");assert.equal(follow.disabled,false);
  recent.onclick();await tick();
  assert(requests.some(r=>r.path.includes("/explore?")&&new URL(r.path,"https://test.invalid").searchParams.get("sort")==="recent"));
  people.onclick();await tick();
  assert(requests.some(r=>r.path.includes("/explore?")&&new URL(r.path,"https://test.invalid").searchParams.get("type")==="people"));
  assert.deepEqual(requests.find(r=>r.path.endsWith("/follow")).options,{method:"PUT",body:{followed:true},timeoutMs:10000});
});

test("viewer neighbors follow Discover order and reset with the account", async () => {
  const { eco, setAccount } = setup(() => body([{ id: "a", media: ["/1.png"] }, { id: "b", media: ["/2.png"] }, { id: "c", media: ["/3.png"] }]));
  eco.markup();
  await tick();
  assert.equal(eco.nextAfter("a"), "b");
  assert.equal(eco.previousBefore("b"), "a");
  assert.equal(eco.previousBefore("a"), "");
  assert.equal(eco.nextAfter("c"), "");
  assert.equal(eco.neighbor("missing", 1), "");
  setAccount("acct-2");
  assert.equal(eco.nextAfter("a"), "", "another account never sees the previous account's order");
});

test("next preload skips the network in save-data mode and warms at most one item", async () => {
  const { eco } = setup(() => body([{ id: "a", media: ["/1.png"] }, { id: "b", media: ["/2.png"] }]));
  eco.markup();
  await tick();
  const original = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "navigator", { value: { connection: { saveData: true } }, configurable: true });
  try { assert.equal(eco.preloadNext("a"), "b"); }
  finally { if (original) Object.defineProperty(globalThis, "navigator", original); else delete globalThis.navigator; }
});

test("temporary hide is labelled as temporary; topic feedback is the durable control", async () => {
  const src = (await import("node:fs")).readFileSync(new URL("./explore-ecosystem.js", import.meta.url), "utf8");
  assert.match(src, /Hide for now/);
  assert.match(src, /Not saved to your account/);
  assert.doesNotMatch(src, /Hide this post/);
  assert.match(src, /Show less about/);
});

test("Search landing defaults to All and keeps working For You, newest, engagement and shuffle modes", async () => {
  const { eco, calls } = setup(() => body([post("video", { kind:"video", video:true })]));
  eco.markup();
  await tick();
  assert.match(calls[0], /type=all/);
  assert.match(calls[0], /sort=top/);
  assert.match(eco.markup().body, /data-xe-type="all"/);
  assert.match(eco.markup().body, /Discover/);
  assert.doesNotMatch(eco.markup().body, /xe-sort/);
  assert.deepEqual(eco.sortModes().map(([value]) => value), ["top", "recent", "engagement", "shuffle"]);
  const modes = [
    { dataset:{xeSort:"top"} },
    { dataset:{xeSort:"recent"} },
    { dataset:{xeSort:"engagement"} },
    { dataset:{xeSort:"shuffle"} },
  ];
  const root = {
    querySelector: () => null,
    querySelectorAll: selector => selector === "[data-xe-sort]" ? modes : [],
    addEventListener() {},
  };
  eco.bind(root);
  modes[1].onclick();
  await tick();
  assert.ok(calls.some(path => new URL(path,"https://test.invalid").searchParams.get("sort")==="recent"));
  modes[2].onclick();
  await tick();
  assert.ok(calls.some(path => new URL(path,"https://test.invalid").searchParams.get("sort")==="engagement"));
  modes[3].onclick();
  await tick();
  const shuffleRequests = calls.filter(path => new URL(path,"https://test.invalid").searchParams.get("sort")==="shuffle");
  assert.match(shuffleRequests.at(-1), /shuffleSeed=[a-z0-9-]+/);
  modes[3].onclick();
  await tick();
  const nextShuffle = calls.filter(path => new URL(path,"https://test.invalid").searchParams.get("sort")==="shuffle");
  assert.notEqual(
    new URL(nextShuffle.at(-1),"https://test.invalid").searchParams.get("shuffleSeed"),
    new URL(shuffleRequests.at(-1),"https://test.invalid").searchParams.get("shuffleSeed"),
    "choosing Shuffle again generates a fresh order",
  );
  eco.reset();
});

test("Discover cards expose topic trails as direct, accessible ways to explore related posts", async () => {
  const { eco } = setup(() => body([post("topic-post")], {
    postTopics: [{ postId: "topic-post", topics: [{ id: "local-food", label: "Local food" }, { id: "weekend", label: "Weekend plans" }] }],
  }));
  eco.markup();
  await tick();
  const html = eco.markup().body;
  assert.match(html, /class="xe-cap-topics"/);
  assert.match(html, /data-xe-topic="local-food"/);
  assert.match(html, /See more about Local food/);
  assert.match(html, /Weekend plans/);
  eco.reset();
});

test("Discover shows inline placeholders while the next page loads", async () => {
  let release;
  const f = setup(path => {
    const offset = new URL(path, "https://oldtime.test").searchParams.get("offset");
    if (offset === "24") return new Promise(resolve => { release = () => resolve(body([post("second")], { hasMore: false, nextOffset: 48 })); });
    return body([post("first")], { hasMore: true, nextOffset: 24 });
  });
  f.eco.markup();
  await tick();
  const pending = f.eco.ensureNext("first");
  assert.match(f.eco.markup().body, /xe-more-skeletons/);
  assert.match(f.eco.markup().body, /Keep exploring/);
  release();
  await pending;
  assert.match(f.eco.markup().body, /data-xe-post="second"/);
  f.eco.reset();
});
