export const COMMENT_PAGE = 20;
export const COMMENT_MAX = 100;

export function nextCommentLimit(current, total) {
  return Math.min(current + COMMENT_PAGE, total, COMMENT_MAX);
}
