import type { CommentRecord } from './commentsTypes';

// Very simple in-memory store. Resets on dev reload; fine for now.
const store: { comments: CommentRecord[] } = {
  comments: [],
};

export function addComment(c: CommentRecord) {
  store.comments.push(c);
}

export function listCommentsByPage(page?: string) {
  if (!page) return store.comments;
  return store.comments.filter((c) => c.page === page);
}

export function getAll() {
  return store.comments;
}

