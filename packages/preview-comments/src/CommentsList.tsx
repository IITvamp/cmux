import React from 'react';
import { Comment } from './types';
import clsx from 'clsx';

interface CommentsListProps {
  comments: Comment[];
}

export function CommentsList({ comments }: CommentsListProps) {
  if (comments.length === 0) {
    return (
      <div className="cmux-text-center cmux-py-8 cmux-text-neutral-500">
        No comments yet
      </div>
    );
  }

  return (
    <div className="cmux-space-y-3">
      {comments.map(comment => (
        <div
          key={comment.id}
          className={clsx(
            'cmux-p-3 cmux-rounded-lg cmux-border cmux-border-neutral-200',
            comment.resolved && 'cmux-opacity-60'
          )}
        >
          <div className="cmux-flex cmux-items-start cmux-justify-between cmux-mb-2">
            <span className="cmux-text-sm cmux-font-medium cmux-text-neutral-900">
              {comment.userName}
            </span>
            <span className="cmux-text-xs cmux-text-neutral-500">
              {new Date(comment.timestamp).toLocaleString()}
            </span>
          </div>
          <p className="cmux-text-sm cmux-text-neutral-700">{comment.text}</p>
          <div className="cmux-mt-2 cmux-text-xs cmux-text-neutral-500">
            {comment.page}
          </div>
        </div>
      ))}
    </div>
  );
}