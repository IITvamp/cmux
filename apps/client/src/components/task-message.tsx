import { formatDistanceToNow } from "date-fns";
import type { ReactNode } from "react";

import { MarkdownProse } from "./markdown-prose";

type Props = {
  authorName: string;
  content: string;
  timestamp?: number;
  avatar?: ReactNode; // If provided, rendered instead of image url
  authorImageUrl?: string;
  authorAlt?: string;
};

export function TaskMessage({
  authorName,
  content,
  timestamp,
  avatar,
  authorImageUrl,
  authorAlt,
}: Props) {
  return (
    <div className="mb-6">
      <div className="bg-neutral-100 dark:bg-neutral-800 rounded-lg px-4 py-3">
        <div className="flex items-start gap-2 mb-2">
          {avatar ? (
            <div className="size-5 flex-shrink-0 flex items-center justify-center">
              {avatar}
            </div>
          ) : (
            <img
              src={authorImageUrl || ""}
              alt={authorAlt || authorName}
              className="size-5 rounded-full flex-shrink-0"
            />
          )}
          <div className="flex items-baseline gap-2">
            <span className="text-[13px] font-medium text-neutral-900 dark:text-neutral-100">
              {authorName}
            </span>
            {timestamp ? (
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                {formatDistanceToNow(timestamp, { addSuffix: true })}
              </span>
            ) : null}
          </div>
        </div>
        <MarkdownProse
          content={content}
          className="text-[15px] font-medium text-neutral-700 dark:text-neutral-300"
        />
      </div>
    </div>
  );
}
