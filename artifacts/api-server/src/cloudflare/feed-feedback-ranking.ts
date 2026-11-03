export interface FeedFeedbackRankItem {
  id: string;
  authorId: string;
}
export interface FeedFeedbackSignal {
  postId: string;
  authorId: string;
}

export function downrankNotInterestedCreators<T extends FeedFeedbackRankItem>(
  ranked: readonly T[],
  feedback: readonly FeedFeedbackSignal[],
): T[] {
  const hiddenPosts = new Set(feedback.map(signal => signal.postId));
  const hiddenAuthors = new Set(feedback.map(signal => signal.authorId));
  return ranked.map((post, index) => ({ post, index, penalty:
    hiddenPosts.has(post.id) ? 2 : hiddenAuthors.has(post.authorId) ? 1 : 0,
  })).sort((a, b) => a.penalty - b.penalty || a.index - b.index).map(item => item.post);
}
