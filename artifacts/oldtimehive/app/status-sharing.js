import { api } from "./store.js";
import { findSharedComment } from "./shared-content.js";

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function sharedStatusTarget(text) {
  try {
    const url = new URL(String(text).trim());
    if (!["https:", "http:"].includes(url.protocol)) return null;
    const postId = /^\/p\/([^/]+)\/?$/.exec(url.pathname)?.[1] || url.searchParams.get("post");
    const commentId = url.searchParams.get("comment") || "";
    return UUID.test(postId || "") && (!commentId || UUID.test(commentId)) ? { postId, commentId } : null;
  } catch { return null; }
}

export function validateStatusShare(postId, commentId = "") {
  const post = api.post(postId);
  if (!post || !api.canSeePost(post)) throw new Error("This post is no longer available.");
  if (!api.canSeePost(post, null)) throw new Error("Only public posts can be shared to Status.");
  if (commentId && !findSharedComment(post, commentId)) throw new Error("This comment is no longer available.");
  return post;
}

// Reuse the existing renderer for attribution and comment cards. Flatten only
// the card, not the source video: Status keeps the original moving background.
export async function prepareStatusShare(postId, commentId = "") {
  const post = validateStatusShare(postId, commentId);
  const [{ createProject, createLayer }, { CreativeAssets, drawProject }, { commentSource, resolveCommentSource }] = await Promise.all([
    import("./creative-project.js"), import("./creative-renderer.js"), import("./creative-content.js"),
  ]);
  const source = commentId ? commentSource(postId, commentId) : null;
  const card = createProject(source);
  card.background.color = "rgba(0,0,0,0)";
  const author = api.user(source?.commentAuthorId || post.author) || { username: "member" };
  const media = commentId ? "" : post.media || post.photos?.[0] || "";
  if (source) {
    Object.assign(card.layers[0], { x: .5, y: .5, scale: 1, width: 880 });
  } else {
    const caption = String(post.caption || "").slice(0, 320);
    card.layers = [
      createLayer("text", { text: `@${author.username}`, x: .5, y: .13, width: 900, fontSize: 48, bold: true, shadow: !!media, color: media ? "#ffffff" : "#17191c" }),
      ...(caption ? [createLayer("text", { text: caption, x: .5, y: media ? .82 : .5, width: 900,
        fontSize: media ? 40 : 52, shadow: !!media, color: media ? "#ffffff" : "#17191c" })] : []),
    ];
  }
  const canvas = document.createElement("canvas");
  canvas.width = card.width; canvas.height = card.height;
  const assets = new CreativeAssets();
  try {
    if (author.avatar) await assets.load(author.avatar).catch(() => {});
    drawProject(canvas, card, assets, resolveCommentSource, 0, null);
    const overlay = canvas.toDataURL("image/png");
    const project = createProject();
    project.background = media
      ? { kind: post.kind === "video" ? "video" : "image", media, color: "#17191c" }
      : { kind: "color", color: "#f2f3f5", media: "" };
    project.layers = [createLayer("image", { media: overlay, width: project.width, height: project.height, x: .5, y: .5, scale: 1 })];
    return { initialProject: project, validateSource: () => validateStatusShare(postId, commentId) };
  } finally {
    assets.dispose();
    canvas.width = canvas.height = 0;
  }
}
