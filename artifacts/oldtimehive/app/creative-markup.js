import { api } from "./store.js";
import { projectSources, projectScenes } from "./creative-project.js";

export function creativeMediaMarkup(item, esc, story = false, thumbnail = false, initialSlide = 0) {
  const scenes = projectScenes(item.creativeProject);
  const carousel = !story && !thumbnail && item.kind === "carousel" && scenes.length > 1;
  const selected = carousel ? Math.max(0, Math.min(scenes.length - 1, Number(initialSlide) || 0)) : 0;
  const canvas = `<canvas class="${thumbnail ? "creative-thumbnail-media" : story ? "creative-story-media" : "creative-post-media"}" width="1080" height="1920"
    data-creative-id="${esc(item.id)}" ${story ? 'data-creative-story="true"' : ""}
    ${carousel ? `data-creative-carousel="true" data-creative-initial-slide="${selected}" role="img" aria-label="Photo ${selected + 1} of ${scenes.length}"` : thumbnail ? 'data-creative-thumbnail="true" role="img" aria-label="Remix preview"' : 'role="button" tabindex="0" aria-label="Comment remix. Tap the original comment to open its context."' }></canvas>`;
  return carousel ? `<div class="creative-post-carousel" data-carousel-count="${scenes.length}">${canvas}<span class="creative-carousel-count" data-creative-carousel-count>${selected + 1}/${scenes.length}</span></div>` : canvas;
}
export function creativeAttribution(item, esc) {
  const source = projectSources(item.creativeProject)[0];
  if (!source) return "";
  return `<button type="button" class="creative-attribution" data-creative-source-post="${esc(source.postId)}"
    data-creative-source-comment="${esc(source.commentId)}">Remixed from @${esc(api.user(source.commentAuthorId)?.username || "member")}</button>`;
}
export function creativeAspect(project) {
  const scene=projectScenes(project)[0];
  const ratio=Number(scene?.width)/Number(scene?.height);
  return Number.isFinite(ratio)?Math.max(.3,Math.min(3,ratio)):9/16;
}
